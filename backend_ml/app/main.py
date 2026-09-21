# ============================================================
# FastAPI service exposing the real Hybrid-AI pipeline:
#   CNN (drone/aerial) + LSTM (time-series) + GA (routing)
#   fused through /api/ml/fusion.
# ============================================================
import gc
import time
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.core.utils import resolve_engine, torch_is_available, yolo_is_available
from app.models.cnn_detector import analyze_image_bytes
from app.models.ga_router import optimize_routes
from app.models.lstm_forecaster import run_forecast
from app.schemas import HealthResponse, LocationRequest, OptimizeRequest
from app.services.fusion import fusion_analysis
from app.services.weather import fetch_weather_hydrology

app = FastAPI(
    title="Multi-Hazard Hybrid-AI Engine",
    description="Real CNN + LSTM + Genetic-Algorithm pipeline for structural/flood monitoring.",
    version=config.SERVICE_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"status": "online", "service": "Multi-Hazard ML Engine", "version": "1.0.0"}


@app.get("/api/ml/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        success=True,
        service=config.SERVICE_NAME,
        version=config.SERVICE_VERSION,
        engine=resolve_engine(),
        torchAvailable=torch_is_available(),
        yoloAvailable=yolo_is_available(),
        modelDir=str(config.MODEL_DIR),
        blobCacheDir=str(config.BLOB_CACHE_DIR),
        status="ok",
    )


@app.get("/api/ml/fusion")
def fusion(lat: float, lng: float, city: str = ""):
    try:
        report = fusion_analysis(lat, lng, city)
        gc.collect()
        return {"success": True, **report}
    except Exception as err:
        return {
            "success": True,
            "error": str(err),
            "lat": lat,
            "lng": lng,
            "city": city,
            "fused": {"riskScore": 0.0, "riskLevel": "LOW", "error": str(err)},
            "lstm": {"error": str(err), "floodRiskScore": 0.0, "dynamicWeight": 0.5, "riskLevel": "UNKNOWN"},
            "cnn": {"error": str(err)},
            "ga": {"error": str(err), "routes": []},
        }


@app.post("/api/ml/cnn/analyze")
async def cnn_analyze(
    file: UploadFile = File(...),
    lat: float = Form(26.8467),
    lng: float = Form(80.9462),
    coverage_km: Optional[float] = Form(None),
):
    """Analyse a user-uploaded aerial/damage image with the real CNN."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large")
    try:
        res = analyze_image_bytes(data, lat, lng, coverage_km, image_url=f"upload:{file.filename}")
        gc.collect()
        return {
            "success": True,
            "filename": file.filename or "",
            "lat": lat,
            "lng": lng,
            "coverageKm": res.floodedAreaSqKm,
            "structuralIntegrity": res.structuralIntegrity,
            "floodSubmersion": res.floodSubmersion,
            "damageClass": res.damageClass,
            "detectionConfidence": res.detectionConfidence,
            "damageScore": res.damage_score,
            "floodedAreaSqKm": res.floodedAreaSqKm,
            "blockedRoadNodes": res.blockedRoadNodes,
            "blockedRoadRatio": res.blockedRoadRatio,
            "waterRatio": res.water_ratio,
            "framesDecoded": res.framesDecoded,
            "imageSource": res.image_source,
        }
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@app.get("/api/ml/lstm/forecast")
def lstm_forecast(lat: float, lng: float, city: str = ""):
    try:
        weather = fetch_weather_hydrology(lat, lng)
        res = run_forecast(lat, lng, weather, city)
        gc.collect()
        res["error"] = weather.error
        return {"success": True, **res}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))


@app.post("/api/ml/ga/optimize", response_model=None)
def ga_optimize(req: OptimizeRequest):
    try:
        dynamic_weight = None
        blocked_nodes = None
        if req.lstm and "dynamicWeight" in req.lstm:
            dynamic_weight = float(req.lstm["dynamicWeight"])
        if req.cnn and "blockedRoadNodes" in req.cnn:
            blocked_nodes = req.cnn.get("blockedRoadNodes") or []
        res = optimize_routes(req.lat, req.lng, blocked_nodes, dynamic_weight)
        gc.collect()
        return {"success": True, **res}
    except Exception as err:
        raise HTTPException(status_code=500, detail=str(err))