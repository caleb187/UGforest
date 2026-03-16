from pydantic import BaseModel
from typing import Optional, List


# ============================================================================
# DATA MODELS
# ============================================================================

class ForestStats(BaseModel):
    """Forest health statistics"""
    healthy_pct:   float
    at_risk_pct:   float
    degraded_pct:  float
    cleared_pct:   float
    total_area_ha: float
    ndvi_mean:     float


class RiskAlert(BaseModel):
    """Risk assessment alert"""
    level:   str    # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    score:   int    # 0-100
    message: str


class ForestInsight(BaseModel):
    """AI-generated forest insights from Gemini"""
    summary:               str
    likely_cause:          str
    severity_explanation:  str
    recommended_actions:   List[str]
    trend_assessment:      str


# ============================================================================
# REQUEST MODELS
# ============================================================================

class AnalyzeRequest(BaseModel):
    """Request to analyze forest health at a location"""
    lat:       float          # e.g. 0.45
    lng:       float          # e.g. 32.95
    year:      int   = 2024   # default to latest
    radius_km: float = 5.0    # area to analyze around point


class CompareRequest(BaseModel):
    """Request to compare forest health between two years"""
    lat:       float
    lng:       float
    year_a:    int   = 2020   # baseline year
    year_b:    int   = 2024   # comparison year
    radius_km: float = 5.0


# ============================================================================
# RESPONSE MODELS
# ============================================================================

class AnalyzeResponse(BaseModel):
    """Forest analysis response with statistics and AI insights"""
    location:    dict                         # {lat, lng, name}
    year:        int
    stats:       ForestStats
    alert:       RiskAlert
    data_source: str
    insight:     Optional[ForestInsight] = None


class CompareResponse(BaseModel):
    """Year-over-year forest comparison response"""
    location:        dict
    year_a:          int
    year_b:          int
    stats_a:         ForestStats
    stats_b:         ForestStats
    forest_lost_pct: float
    forest_lost_ha:  float
    alert:           RiskAlert
    change_summary:  str
    insight:         Optional[ForestInsight] = None


# ============================================================================
# ON-DEMAND INSIGHT MODELS
# ============================================================================

class InsightRequest(BaseModel):
    """Request for on-demand AI insight generation"""
    lat:            float
    lng:            float
    year:           int
    location_name:  str
    healthy_pct:    float
    at_risk_pct:    float
    degraded_pct:   float
    cleared_pct:    float
    total_area_ha:  float
    ndvi_mean:      float
    alert_level:    str
    risk_score:     int
    # Optional comparison fields
    year_a:         Optional[int]   = None
    year_b:         Optional[int]   = None
    forest_lost_ha: Optional[float] = None
    healthy_pct_a:  Optional[float] = None
    healthy_pct_b:  Optional[float] = None


class InsightResponse(BaseModel):
    """Response containing AI-generated insights"""
    insight: Optional[ForestInsight] = None
    error:   Optional[str]          = None


