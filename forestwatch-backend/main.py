import asyncio
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    AnalyzeRequest, AnalyzeResponse,
    CompareRequest, CompareResponse,
    ForestStats, RiskAlert,
    AlertsResponse, ScanAlert,
    InsightRequest, InsightResponse,
)
from analyzer import (
    FORESTS, STAT_KEYS,
    analyze_location_gee as analyze,
    get_map_tiles,
    uganda_risk_score,
    score_to_alert,
    km_to_area_ha,
    get_forest_name,
    generate_forest_insight,
)

from scanner import start_scheduler, stop_scheduler, get_all_alerts, get_recent_alerts, run_weekly_scan

# ============================================================================
# APP
# ============================================================================

@asynccontextmanager
async def lifespan(app):
    """Start the weekly scanner on startup, stop on shutdown."""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="ForestWatch AI",
    description="AI-powered deforestation detection for Uganda",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=4)


class TilesRequest(BaseModel):
    lat:       float
    lng:       float
    year_a:    int   = 2020
    year_b:    int   = 2024
    radius_km: float = 10.0


def _build_stats(data: dict) -> ForestStats:
    return ForestStats(**{k: data[k] for k in STAT_KEYS})


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    return {
        "system":  "ForestWatch AI",
        "status":  "online",
        "version": "1.0.0",
        "endpoints": ["/analyze", "/compare", "/tiles", "/forests", "/alerts", "/alerts/latest", "/scan/trigger", "/health", "/docs"],
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/forests")
def list_forests():
    """List major Uganda forests with coordinates."""
    return {"forests": {
        k.lower().split()[0]: {"name": k, "lat": v[0], "lng": v[1]}
        for k, v in FORESTS.items()
    }}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_forest(req: AnalyzeRequest):
    """Analyze forest health at a location (no AI — use /insight for that)."""
    t0 = time.time()

    try:
        data = analyze(req.lat, req.lng, req.year, req.radius_km)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    try:
        score = uganda_risk_score(data["cleared_pct"], data["degraded_pct"], data["ndvi_mean"])
        alert = score_to_alert(score)
        name  = get_forest_name(req.lat, req.lng)

        print(f"✓ Analyze {time.time()-t0:.2f}s")

        return AnalyzeResponse(
            location={"lat": req.lat, "lng": req.lng, "name": name},
            year=req.year,
            stats=_build_stats(data),
            alert=RiskAlert(**alert),
            data_source="Sentinel-2 / GEE",
        )
    except Exception as e:
        print(f"✗ Response error: {e}")
        raise HTTPException(500, f"Internal server error: {e}")


@app.post("/compare", response_model=CompareResponse)
async def compare_years(req: CompareRequest):
    """Compare forest health between two years — parallel GEE calls (no AI)."""
    t0 = time.time()
    loop = asyncio.get_event_loop()

    try:
        data_a, data_b = await asyncio.gather(
            loop.run_in_executor(_executor, analyze, req.lat, req.lng, req.year_a, req.radius_km),
            loop.run_in_executor(_executor, analyze, req.lat, req.lng, req.year_b, req.radius_km),
        )
    except Exception as e:
        raise HTTPException(500, f"Comparison failed: {e}")

    try:
        forest_lost_pct = round(data_a["healthy_pct"] - data_b["healthy_pct"], 1)
        forest_lost_ha  = round((forest_lost_pct / 100) * data_a["total_area_ha"], 1)

        score = uganda_risk_score(data_b["cleared_pct"], data_b["degraded_pct"], data_b["ndvi_mean"])
        alert = score_to_alert(score)
        name  = get_forest_name(req.lat, req.lng)

        change_summary = (
            f"Between {req.year_a} and {req.year_b}, healthy forest cover changed from "
            f"{data_a['healthy_pct']}% to {data_b['healthy_pct']}% — "
            f"a loss of {forest_lost_ha} hectares."
            if forest_lost_pct > 0
            else f"Forest cover remained stable between {req.year_a} and {req.year_b}."
        )

        print(f"✓ Compare {time.time()-t0:.2f}s")

        return CompareResponse(
            location={"lat": req.lat, "lng": req.lng},
            year_a=req.year_a, year_b=req.year_b,
            stats_a=_build_stats(data_a),
            stats_b=_build_stats(data_b),
            forest_lost_pct=forest_lost_pct,
            forest_lost_ha=forest_lost_ha,
            alert=RiskAlert(**alert),
            change_summary=change_summary,
        )
    except Exception as e:
        print(f"✗ Response error: {e}")
        raise HTTPException(500, f"Internal server error: {e}")


@app.post("/insight", response_model=InsightResponse)
def get_insight(req: InsightRequest):
    """On-demand AI insight — only called when user clicks 'AI Insights'."""
    t0 = time.time()
    try:
        stats = {
            'healthy_pct':  req.healthy_pct,
            'at_risk_pct':  req.at_risk_pct,
            'degraded_pct': req.degraded_pct,
            'cleared_pct':  req.cleared_pct,
            'total_area_ha': req.total_area_ha,
        }
        if req.healthy_pct_a is not None:
            stats['healthy_pct_a'] = req.healthy_pct_a
        if req.healthy_pct_b is not None:
            stats['healthy_pct_b'] = req.healthy_pct_b

        insight_raw = generate_forest_insight(
            location_name=req.location_name,
            lat=req.lat, lng=req.lng, year=req.year,
            stats=stats, ndvi_mean=req.ndvi_mean,
            alert_level=req.alert_level, risk_score=req.risk_score,
            year_a=req.year_a, year_b=req.year_b,
            forest_lost_ha=req.forest_lost_ha,
        )

        if insight_raw:
            from models import ForestInsight
            print(f"✓ Insight {time.time()-t0:.2f}s")
            return InsightResponse(insight=ForestInsight(**insight_raw))

        return InsightResponse(error="Gemini returned no insight")
    except Exception as e:
        print(f"✗ Insight error: {e}")
        return InsightResponse(error=str(e))


@app.post("/tiles")
def get_tiles(req: TilesRequest):
    """Get map tiles for visualization."""
    t0 = time.time()
    try:
        tiles = get_map_tiles(req.lat, req.lng, req.year_a, req.year_b, req.radius_km)
    except Exception as e:
        raise HTTPException(500, f"Tile generation failed: {e}")
    print(f"✓ Tiles {time.time()-t0:.2f}s")
    return tiles


# ============================================================================
# ALERT ENDPOINTS
# ============================================================================

@app.get("/alerts", response_model=AlertsResponse)
def list_alerts():
    """Return all automated scan alerts, newest first."""
    alerts = get_all_alerts()
    return AlertsResponse(alerts=[ScanAlert(**a) for a in alerts], count=len(alerts))


@app.get("/alerts/latest", response_model=AlertsResponse)
def list_latest_alerts():
    """Return alerts from the last 7 days."""
    alerts = get_recent_alerts(days=7)
    return AlertsResponse(alerts=[ScanAlert(**a) for a in alerts], count=len(alerts))


@app.get("/scan/trigger")
def trigger_scan():
    """Manually trigger a forest scan (useful for testing)."""
    threading.Thread(target=run_weekly_scan, daemon=True).start()
    return {"status": "scan_started", "message": "Scan running in background. Check /alerts for results."}