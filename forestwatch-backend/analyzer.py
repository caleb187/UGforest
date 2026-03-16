"""
ForestWatch — AI-powered forest deforestation detection for Uganda
Uses Google Earth Engine and Gemini AI for analysis
"""

import json
import math
import os
import threading
import time
from functools import lru_cache

import ee
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# ============================================================================
# SHARED CONSTANTS
# ============================================================================

FORESTS = {
    "Mabira Forest":   (0.45, 32.95),
    "Budongo Forest":  (1.73, 31.55),
    "Kibale Forest":   (0.50, 30.36),
    "Bwindi Forest":   (-1.03, 29.68),
    "Queen Elizabeth":  (-0.20, 29.90),
}

STAT_KEYS = ("healthy_pct", "at_risk_pct", "degraded_pct", "cleared_pct", "total_area_ha", "ndvi_mean")

# ============================================================================
# INITIALIZATION
# ============================================================================

_gee_initialized = False
_gee_lock = threading.Lock()

def init_gee():
    """Initialize Google Earth Engine — thread-safe, raises on failure."""
    global _gee_initialized
    if _gee_initialized:
        return
    with _gee_lock:
        if _gee_initialized:          # double-check after acquiring lock
            return
        ee.Initialize(project='deforestation-489507')
        print("✓ Google Earth Engine connected")
        _gee_initialized = True


def _init_gemini():
    """Initialize Gemini with a known model — no expensive list call."""
    try:
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            print("✗ GEMINI_API_KEY not set")
            return None
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        print("✓ Gemini API configured (gemini-2.5-flash-lite)")
        return model
    except Exception as e:
        print(f"✗ Gemini initialization failed: {e}")
        return None


gemini = _init_gemini()

# ============================================================================
# CACHE
# ============================================================================

_cache = {}
_cache_lock = threading.Lock()
CACHE_TTL = 3600  # 1 hour


def _cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry:
            value, ts = entry
            if time.time() - ts < CACHE_TTL:
                return value
            del _cache[key]
    return None


def _cache_set(key: str, value):
    with _cache_lock:
        _cache[key] = (value, time.time())


# ============================================================================
# SCORING
# ============================================================================

def uganda_risk_score(
    cleared_pct: float,
    degraded_pct: float,
    ndvi_mean: float,
    near_road: bool = False,
    near_settlement: bool = False,
) -> int:
    score = (
        max(0, (0.7 - ndvi_mean) / 0.7) * 35
        + cleared_pct * 0.35
        + degraded_pct * 0.15
        + (10 if near_road else 0)
        + (5 if near_settlement else 0)
    )
    return min(100, round(score))


def score_to_alert(score: int) -> dict:
    if score >= 70:
        return {"level": "CRITICAL", "score": score,
                "message": "Severe deforestation detected. Immediate intervention required."}
    if score >= 50:
        return {"level": "HIGH", "score": score,
                "message": "Significant forest loss detected. Urgent monitoring needed."}
    if score >= 30:
        return {"level": "MEDIUM", "score": score,
                "message": "Moderate vegetation stress. Area should be monitored closely."}
    return {"level": "LOW", "score": score,
            "message": "Forest cover appears stable. Continue routine monitoring."}


def km_to_area_ha(radius_km: float) -> float:
    return round(math.pi * radius_km ** 2 * 100, 1)


# ============================================================================
# EARTH ENGINE HELPERS
# ============================================================================

def _get_imagery(year: int, region):
    """Get satellite imagery — falls back S2 -> L8 -> L7 with standard band renaming."""

    # Sentinel-2 (2015+)
    if year >= 2015:
        s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
              .filterBounds(region)
              .filterDate(f'{year}-01-01', f'{year}-12-31')
              .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))
        if s2.size().getInfo() > 0:
            return s2.median().select(['B4', 'B8'], ['Red', 'NIR']).clip(region)

    # Landsat 8 (2013+)
    if year >= 2013:
        l8 = (ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
              .filterBounds(region)
              .filterDate(f'{year}-01-01', f'{year}-12-31')
              .filter(ee.Filter.lt('CLOUD_COVER', 20)))
        if l8.size().getInfo() > 0:
            return l8.median().select(['SR_B4', 'SR_B5'], ['Red', 'NIR']).clip(region)

    # Landsat 7 (pre-2013 or final fallback)
    l7 = (ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
          .filterBounds(region)
          .filterDate(f'{year}-01-01', f'{year}-12-31')
          .filter(ee.Filter.lt('CLOUD_COVER', 20)))
    return l7.median().select(['SR_B3', 'SR_B4'], ['Red', 'NIR']).clip(region)


def _get_natural_colour(year: int, region):
    """Return a Sentinel-2 / Landsat true-colour RGB composite for the given year.

    Band mapping (all kept in their original scale — vis params handle normalisation):
      S2  : B4=Red, B3=Green, B2=Blue  (scale 0-10000)
      L8  : SR_B4=Red, SR_B3=Green, SR_B2=Blue
      L7  : SR_B3=Red, SR_B2=Green, SR_B1=Blue
    """
    # Sentinel-2 (2015+)
    if year >= 2015:
        s2 = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
              .filterBounds(region)
              .filterDate(f'{year}-01-01', f'{year}-12-31')
              .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)))
        if s2.size().getInfo() > 0:
            return s2.median().select(['B4', 'B3', 'B2']).clip(region)

    # Landsat 8 (2013+)
    if year >= 2013:
        l8 = (ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
              .filterBounds(region)
              .filterDate(f'{year}-01-01', f'{year}-12-31')
              .filter(ee.Filter.lt('CLOUD_COVER', 20)))
        if l8.size().getInfo() > 0:
            return l8.median().select(['SR_B4', 'SR_B3', 'SR_B2']).clip(region)

    # Landsat 7 (pre-2013 or final fallback)
    l7 = (ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
          .filterBounds(region)
          .filterDate(f'{year}-01-01', f'{year}-12-31')
          .filter(ee.Filter.lt('CLOUD_COVER', 20)))
    return l7.median().select(['SR_B3', 'SR_B2', 'SR_B1']).clip(region)


def _ndvi(image, year: int):
    """Compute NDVI using the standardized band names."""
    return image.normalizedDifference(['NIR', 'Red']).rename('NDVI')


def _risk_map(ndvi_image):
    """Classify NDVI into 4 risk levels: 0=healthy, 1=at-risk, 2=degraded, 3=cleared."""
    return (
        ndvi_image.gt(0.6).multiply(0)
        .add(ndvi_image.gt(0.4).And(ndvi_image.lte(0.6)).multiply(1))
        .add(ndvi_image.gt(0.2).And(ndvi_image.lte(0.4)).multiply(2))
        .add(ndvi_image.lte(0.2).multiply(3))
        .rename('risk')
    )


# ============================================================================
# CORE ANALYSIS
# ============================================================================

def analyze_location_gee(lat: float, lng: float, year: int, radius_km: float) -> dict:
    """Analyze forest health at a location — cached, optimized GEE query."""
    init_gee()

    cache_key = f"analyze_{lat}_{lng}_{year}_{radius_km}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    region = ee.Geometry.Point([lng, lat]).buffer(radius_km * 1000)
    img = _get_imagery(year, region)
    ndvi = _ndvi(img, year)
    risk = _risk_map(ndvi).byte()

    combined = risk.addBands(ndvi).reduceRegion(
        reducer=ee.Reducer.frequencyHistogram().combine(ee.Reducer.mean(), "", True),
        geometry=region, scale=200, maxPixels=1e7,
    ).getInfo() or {}

    hist = combined.get('risk_histogram') or combined.get('risk', {})
    if not hist and combined.get('NDVI_mean') is not None:
        # Fallback if histogram is missing but mean exists (e.g. single pixel)
        val = '0' if combined['NDVI_mean'] > 0.6 else '1' if combined['NDVI_mean'] > 0.4 else '2' if combined['NDVI_mean'] > 0.2 else '3'
        hist = {val: 1}

    total = sum(hist.values()) or 1

    result = {
        "healthy_pct":   round(hist.get('0', 0) / total * 100, 1),
        "at_risk_pct":   round(hist.get('1', 0) / total * 100, 1),
        "degraded_pct":  round(hist.get('2', 0) / total * 100, 1),
        "cleared_pct":   round(hist.get('3', 0) / total * 100, 1),
        "ndvi_mean":     round(combined.get('NDVI_mean') or 0.5, 3),
        "total_area_ha": km_to_area_ha(radius_km),
    }

    _cache_set(cache_key, result)
    return result


def get_map_tiles(lat: float, lng: float, year_a: int, year_b: int, radius_km: float) -> dict:
    """Get GEE map tile URLs for NDVI, change, and risk layers."""
    init_gee()

    cache_key = f"tiles_{lat}_{lng}_{year_a}_{year_b}_{radius_km}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        region = ee.Geometry.Point([lng, lat]).buffer(radius_km * 1000)
        ndvi_a = _ndvi(_get_imagery(year_a, region), year_a)
        ndvi_b = _ndvi(_get_imagery(year_b, region), year_b)

        def tile_url(image, vis):
            try:
                return image.getMapId(vis)['tile_fetcher'].url_format
            except Exception:
                return ""

        # Natural-colour composites for the before/after satellite panel
        nat_vis = {'min': 0, 'max': 3000, 'gamma': 1.4}
        nc_a = _get_natural_colour(year_a, region)
        nc_b = _get_natural_colour(year_b, region)

        result = {
            'ndvi': tile_url(ndvi_b, {
                'min': 0, 'max': 0.9,
                'palette': ['red', 'orange', 'yellow', 'lightgreen', 'darkgreen'],
            }),
            'change': tile_url(ndvi_b.subtract(ndvi_a).rename('change'), {
                'min': -0.4, 'max': 0.4,
                'palette': ['red', 'white', 'darkgreen'],
            }),
            'risk': tile_url(_risk_map(ndvi_b), {
                'min': 0, 'max': 3,
                'palette': ['darkgreen', 'yellow', 'orange', 'red'],
            }),
            'natural_a': tile_url(nc_a, nat_vis),
            'natural_b': tile_url(nc_b, nat_vis),
            'year_a': year_a,
            'year_b': year_b,
        }
        _cache_set(cache_key, result)
        return result

    except Exception as e:
        print(f"✗ Tile error: {e}")
        return {'ndvi': '', 'change': '', 'risk': '', 'natural_a': '', 'natural_b': '',
                'year_a': year_a, 'year_b': year_b, 'error': str(e)}


def get_basemap_tiles() -> dict:
    """Get a GEE tile URL for the Uganda-wide Sentinel-2 2024 natural colour composite.

    Returns {"url": "https://..."}. Cached for 1 hour.
    """
    init_gee()

    cache_key = "basemap_2024"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        # Uganda bounding box (W, S, E, N)
        uganda = ee.Geometry.Rectangle([29.5, -1.5, 35.1, 4.3])

        s2 = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(uganda)
            .filterDate('2024-01-01', '2024-12-31')
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        )

        if s2.size().getInfo() == 0:
            # Fallback to Landsat 8 2024
            l8 = (
                ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                .filterBounds(uganda)
                .filterDate('2024-01-01', '2024-12-31')
                .filter(ee.Filter.lt('CLOUD_COVER', 20))
            )
            composite = l8.median().select(['SR_B4', 'SR_B3', 'SR_B2'])
        else:
            composite = s2.median().select(['B4', 'B3', 'B2'])

        url = composite.getMapId(
            {'min': 0, 'max': 3000, 'gamma': 1.4}
        )['tile_fetcher'].url_format

        result = {'url': url}
        _cache_set(cache_key, result)
        print("✓ Basemap tile URL generated")
        return result

    except Exception as e:
        print(f"✗ Basemap error: {e}")
        return {'url': '', 'error': str(e)}


# ============================================================================
# LOCATION UTILITIES
# ============================================================================

def get_forest_name(lat: float, lng: float) -> str:
    """Find the nearest major Uganda forest within ~100 km."""
    best_name, best_dist = "Unknown Forest", float('inf')
    for name, (f_lat, f_lng) in FORESTS.items():
        dist = math.hypot(lat - f_lat, lng - f_lng) * 111
        if dist < best_dist and dist < 100:
            best_name, best_dist = name, dist
    return best_name


# ============================================================================
# AI INSIGHTS (Gemini)
# ============================================================================

_insight_cache = {}
_insight_cache_lock = threading.Lock()


def generate_forest_insight(
    location_name: str, lat: float, lng: float, year: int,
    stats: dict, ndvi_mean: float, alert_level: str, risk_score: int,
    year_a: int = None, year_b: int = None, forest_lost_ha: float = None,
) -> dict | None:
    """Send forest data to Gemini and get back a structured intelligence briefing."""
    if gemini is None:
        print("✗ Gemini not initialized — check GEMINI_API_KEY")
        return None

    # Cache key: rounded lat/lng + year (so same-area clicks reuse the result)
    cache_key = f"insight_{round(lat, 2)}_{round(lng, 2)}_{year}"
    with _insight_cache_lock:
        if cache_key in _insight_cache:
            print(f"✓ Insight cache hit: {cache_key}")
            return _insight_cache[cache_key]

    change_ctx = ""
    if forest_lost_ha is not None:
        change_ctx = (
            f"\n- Comparing {year_a} to {year_b}"
            f"\n- Forest lost: {forest_lost_ha} hectares"
            f"\n- Change in healthy cover: {stats.get('healthy_pct_a', 'N/A')}% → {stats.get('healthy_pct_b', 'N/A')}%"
        )

    prompt = f"""You are an expert forest conservation analyst specializing in Uganda's ecosystems.

CRITICAL: Your analysis MUST reflect the risk score ({risk_score}/100) and alert level ({alert_level}).
If the alert is HIGH or CRITICAL, there IS significant deforestation/degradation.

Analyze this satellite data and provide a concise intelligence briefing.

LOCATION: {location_name}
COORDINATES: {lat:.4f}°N, {lng:.4f}°E
YEAR: {year}
ALERT LEVEL: {alert_level}
RISK SCORE: {risk_score}/100

LAND COVER BREAKDOWN:
- Healthy forest: {stats['healthy_pct']}%
- At risk vegetation: {stats['at_risk_pct']}%
- Degraded land: {stats['degraded_pct']}%
- Cleared land: {stats['cleared_pct']}%
- Mean NDVI: {ndvi_mean:.3f}
- Total area: {stats['total_area_ha']} ha
{change_ctx}

ANALYSIS RULES:
- cleared% + degraded% > 20% → significant deforestation pressure
- NDVI < 0.5 → stressed forest
- CRITICAL alert → acknowledge severe forest loss
- degraded% > 30% → active deforestation

UGANDA CONTEXT:
- Drivers: charcoal, agriculture, illegal logging, urban encroachment
- Priority forests: Mabira, Budongo, Kibale, Bwindi

Respond ONLY with this JSON (no markdown):
{{
  "summary": "2-3 sentence plain English summary",
  "likely_cause": "Most probable cause matching the metrics",
  "severity_explanation": "Why {alert_level} alert was warranted",
  "recommended_actions": ["action 1", "action 2", "action 3"],
  "trend_assessment": "Future outlook if no action taken"
}}"""

    try:
        text = gemini.generate_content(prompt).text.strip()
        text = text.replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        with _insight_cache_lock:
            _insight_cache[cache_key] = result
        return result
    except Exception as e:
        print(f"✗ Gemini error: {e}")
        return None