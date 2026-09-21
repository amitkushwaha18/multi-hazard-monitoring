# ============================================================
# FUSION ORCHESTRATOR - interconnects all real ML sub-systems.
#
#   weather (live telemetry)
#        |
#        v
#     LSTM  -- floodRiskScore/dynamicWeight --\
#        |                                      \
#     CNN   -- blockedRoadNodes/blockedRatio  --)> GA router
#        |                                         |
#        +---< fusion risk score + XAI <------------+
#
# Each subsystem is real and computed live; nothing is mocked.
# ============================================================
import time
from typing import Dict, Optional

from app import config
from app.core.utils import clamp
from app.models.cnn_detector import analyze_location
from app.models.ga_router import optimize_routes
from app.models.lstm_forecaster import run_forecast
from app.services.weather import fetch_weather_hydrology

_pipeline_cache: Dict[tuple, dict] = {}


def _analysis_report(lat: float, lng: float, city_name: str = "") -> dict:
    """Run the full integrated pipeline once and cache briefly."""
    t0 = time.time()
    # 1) live weather + hydrology telemetry (external Open-Meteo/GloFAS)
    try:
        weather = fetch_weather_hydrology(lat, lng)
    except Exception as err:
        weather = None
        weather_err = str(err)

    # 2) LSTM forecast + flood risk
    if weather is None:
        lstm = _lstm_error(f"weather telemetry unavailable: {weather_err}")
    else:
        try:
            lstm = run_forecast(lat, lng, weather, city_name)
            lstm["error"] = weather.error
        except Exception as err:
            lstm = _lstm_error(str(err))

    # 3) CNN aerial/drone analysis (structural + flood + road-grid)
    try:
        cnn = _cnn_to_dict(analyze_location(lat, lng))
    except Exception as err:
        cnn = _cnn_error(str(err))

    # 4) GA router constrained by CNN blocked junctions + LSTM risk
    try:
        ga = optimize_routes(
            lat,
            lng,
            blocked_nodes=cnn.get("blockedRoadNodes") or None,
            dynamic_weight=lstm.get("dynamicWeight"),
        )
    except Exception as err:
        ga = _ga_error(str(err))

    # 5) Fusion risk score: weighted combination of real subsystem scores
    cnn_risk = clamp(cnn.get("damageScore", 0.0) * 0.7 + cnn.get("floodSubmersion", 0.0) * 0.3, 0, 100)
    lstm_risk = lstm.get("floodRiskScore", 0.0)
    ga_weight = clamp(ga.get("constraints", {}).get("dynamicWeight", 0.5), 0, 1)
    fused = clamp(0.45 * lstm_risk + 0.4 * cnn_risk + 0.15 * (ga_weight * 100.0), 0, 100)
    level = _risk_label(fused)

    elapsed = round(time.time() - t0, 2)
    report = {
        "lat": round(float(lat), 4),
        "lng": round(float(lng), 4),
        "city": city_name,
        "fused": {
            "riskScore": round(float(fused), 1),
            "riskLevel": level,
            "cnnWeight": round(clamp(cnn_risk / max(fused, 1e-6), 0, 1), 3),
            "lstmWeight": round(clamp(lstm_risk / max(fused, 1e-6), 0, 1), 3),
            "elapsedSec": elapsed,
        },
        "lstm": lstm,
        "cnn": cnn,
        "ga": ga,
    }
    return report


def _cnn_to_dict(res):
    return {
        "imageSource": res.image_source,
        "imageUrl": res.imageUrl,
        "error": getattr(res, "error", None) or None,
        "structuralIntegrity": round(res.structuralIntegrity, 1),
        "floodSubmersion": round(res.floodSubmersion, 1),
        "floodedAreaSqKm": round(res.floodedAreaSqKm, 3),
        "damageClass": res.damageClass,
        "detectionConfidence": round(res.detectionConfidence, 1),
        "damageScore": round(res.damage_score, 1),
        "blockedRoadNodes": res.blockedRoadNodes,
        "blockedRoadRatio": res.blockedRoadRatio,
        "waterRatio": round(res.water_ratio, 4),
        "framesDecoded": res.framesDecoded,
        "satellitePasses": res.satellitePasses,
        "droneSorties": res.droneSorties,
    }


def _lstm_error(msg: str) -> dict:
    return {
        "error": msg,
        "floodRiskScore": 0.0,
        "dynamicWeight": 0.5,
        "waterLevelPeak": None,
        "riskLevel": "UNKNOWN",
        "history": {
            "time": [],
            "precipitation": [],
            "temperature_2m": [],
            "waterLevel": [],
        },
        "forecast": {
            "time": [],
            "precipitation": [],
            "temperature_2m": [],
            "waterLevel": [],
        },
        "xai": [],
        "model": "unavailable",
        "trainedOnHours": 0,
    }


def _cnn_error(msg: str) -> dict:
    return {
        "imageSource": "error",
        "imageUrl": "",
        "error": msg,
        "blockedRoadNodes": [],
        "blockedRoadRatio": 0.0,
    }


def _ga_error(msg: str) -> dict:
    return {
        "error": msg,
        "routes": [],
        "population": 0,
        "evacuated": 0,
        "arrivals": 0,
        "generation": 0,
        "constraints": {"dynamicWeight": 0.5, "blockedRoadNodes": []},
    }


def _risk_label(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MODERATE"
    return "LOW"


def _fallback_report(lat: float, lng: float, city_name: str, err) -> dict:
    """Full degraded report returned if the pipeline itself fails."""
    return {
        "lat": round(float(lat), 4),
        "lng": round(float(lng), 4),
        "city": city_name,
        "fused": {
            "riskScore": 0.0,
            "riskLevel": "LOW",
            "cnnWeight": 0.0,
            "lstmWeight": 0.0,
            "elapsedSec": 0.0,
            "error": str(err),
        },
        "lstm": _lstm_error(str(err)),
        "cnn": _cnn_error(str(err)),
        "ga": _ga_error(str(err)),
    }


def fusion_analysis(lat: float, lng: float, city_name: str = "") -> dict:
    key = (round(lat, 4), round(lng, 4), city_name, int(time.time() // config.PIPELINE_CACHE_TTL))
    cached = _pipeline_cache.get(key)
    if cached:
        return cached
    try:
        report = _analysis_report(lat, lng, city_name)
    except Exception as err:
        report = _fallback_report(lat, lng, city_name, err)
    _pipeline_cache[key] = report
    return report