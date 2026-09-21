# ============================================================
# Pydantic request/response contracts for the ML API.
# ============================================================
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LocationRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Decimal latitude of the target zone")
    lng: float = Field(..., ge=-180, le=180, description="Decimal longitude of the target zone")
    cityName: str = Field("", max_length=120, description="Human readable location label")
    zoom: Optional[int] = Field(None, ge=13, le=19, description="Imagery zoom level override")


class GAState(BaseModel):
    floodedAreaSqKm: float = Field(0.0, ge=0)
    floodRiskScore: float = Field(0.0, ge=0, le=100)
    dynamicWeight: float = Field(0.0, ge=0, le=1)
    blockedRoadNodes: List[int] = Field(default_factory=list)
    blockedRoadRatio: float = Field(0.0, ge=0, le=1)


class OptimizeRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    cityName: str = Field("", max_length=120)
    cnn: Optional[Dict[str, Any]] = Field(None, description="Pre-computed CNN state feeding GA constraints")
    lstm: Optional[Dict[str, Any]] = Field(None, description="Pre-computed LSTM state feeding GA dynamic weights")


class HealthResponse(BaseModel):
    success: bool
    service: str
    version: str
    engine: str
    torchAvailable: bool
    yoloAvailable: bool
    modelDir: str
    blobCacheDir: str
    status: str