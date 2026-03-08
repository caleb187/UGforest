import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    AnalyzeRequest, AnalyzeResponse,
    CompareRequest, CompareResponse,
    ForestStats, RiskAlert,
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

# ============================================================================
# APP
# ============================================================================

app = FastAPI(
    title="ForestWatch AI",
    description="AI-powered deforestation detection for Uganda",
    version="1.0.0",
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
        "endpoints": ["/analyze", "/compare", "/tiles", "/forests", "/health", "/docs"],
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
    """Analyze forest health at a location with AI insights."""
    t0 = time.time()

    try:
        data = analyze(req.lat, req.lng, req.year, req.radius_km)
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")

    try:
        score = uganda_risk_score(data["cleared_pct"], data["degraded_pct"], data["ndvi_mean"])
        alert = score_to_alert(score)
        name  = get_forest_name(req.lat, req.lng)

        insight_raw = generate_forest_insight(
            location_name=name, lat=req.lat, lng=req.lng, year=req.year,
            stats=data, ndvi_mean=data["ndvi_mean"],
            alert_level=alert["level"], risk_score=score,
        )

        # Robust insight validation
        insight = None
        if insight_raw:
            try:
                from models import ForestInsight
                insight = ForestInsight(**insight_raw)
            except Exception as e:
                print(f"✗ Insight validation failed: {e}")

        print(f"✓ Analyze {time.time()-t0:.2f}s")

        return AnalyzeResponse(
            location={"lat": req.lat, "lng": req.lng, "name": name},
            year=req.year,
            stats=_build_stats(data),
            alert=RiskAlert(**alert),
            ndvi_mean=data["ndvi_mean"],
            data_source="Sentinel-2 / GEE",
            insight=insight,
        )
    except Exception as e:
        print(f"✗ Response error: {e}")
        raise HTTPException(500, f"Internal server error: {e}")


@app.post("/compare", response_model=CompareResponse)
async def compare_years(req: CompareRequest):
    """Compare forest health between two years — parallel GEE calls."""
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

        insight_raw = generate_forest_insight(
            location_name=name, lat=req.lat, lng=req.lng, year=req.year_b,
            stats={
                'healthy_pct_a': data_a['healthy_pct'],
                'healthy_pct_b': data_b['healthy_pct'],
                'healthy_pct': data_b['healthy_pct'],
                'at_risk_pct': data_b['at_risk_pct'],
                'degraded_pct': data_b['degraded_pct'],
                'cleared_pct': data_b['cleared_pct'],
                'total_area_ha': data_a['total_area_ha'],
            },
            ndvi_mean=data_b["ndvi_mean"],
            alert_level=alert["level"], risk_score=score,
            year_a=req.year_a, year_b=req.year_b,
            forest_lost_ha=forest_lost_ha,
        )

        insight = None
        if insight_raw:
            try:
                from models import ForestInsight
                insight = ForestInsight(**insight_raw)
            except Exception as e:
                print(f"✗ Insight validation failed: {e}")

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
            insight=insight,
        )
    except Exception as e:
        print(f"✗ Response error: {e}")
        raise HTTPException(500, f"Internal server error: {e}")


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