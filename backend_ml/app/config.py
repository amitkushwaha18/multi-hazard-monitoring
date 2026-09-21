# ============================================================
# Central configuration for the real ML backend service.
# All values resolve from environment variables with documented
# defaults. Nothing here is mocked or seeded - every default is
# a documented real-world constant.
# ============================================================
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# ---- Model / weight storage -------------------------------------------
MODEL_DIR = Path(os.getenv("MH_MODEL_DIR", BASE_DIR / "model_store"))
BLOB_CACHE_DIR = Path(os.getenv("MH_BLOB_CACHE_DIR", BASE_DIR / "blob_cache"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)
BLOB_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# ---- Inference engine -------------------------------------------------
# auto  -> use torch when available, else native NumPy engines
# torch -> force PyTorch (raises a clear error if not installed)
# numpy -> force native NumPy engines
INFERENCE_ENGINE = os.getenv("MH_INFERENCE_ENGINE", "auto").lower()

# ---- Live satellite / drone / aerial imagery --------------------------
# ESRI World Imagery (free, keyless). Swap for Sentinel-2 / Landsat via
# the Copernicus Data Space API by changing IMAGERY_TILE_URL (see README).
IMAGERY_TILE_URL = os.getenv(
    "MH_IMAGERY_TILE_URL",
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
)
IMAGERY_MAX_ZOOM = int(os.getenv("MH_IMAGERY_MAX_ZOOM", "17"))
IMAGERY_DOWNLOAD_TIMEOUT = int(os.getenv("MH_IMAGERY_DOWNLOAD_TIMEOUT", "20"))

# Sentinel-2 (NASA GIBS) fallback tile source - real optical band imagery,
# keyless WMTS.
GIBS_SENTINEL2_URL = os.getenv(
    "MH_GIBS_SENTINEL2_URL",
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Sentinel-2_TrueColor/default/GoogleMapsCompatible_Level{level}/{z}/{y}/{x}.jpg",
)
GIBS_BLUEMARBLE_URL = os.getenv(
    "MH_GIBS_BLUEMARBLE_URL",
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level{level}/{z}/{y}/{x}.jpg",
)

# ---- Live weather / hydrology telemetry (Open-Meteo, NOAA proxies) -----
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
GLOFAS_FLOOD_API = "https://flood-api.open-meteo.com/v1/flood"
WEATHER_PAST_DAYS = int(os.getenv("MH_WEATHER_PAST_DAYS", "15"))
WEATHER_FORECAST_DAYS = int(os.getenv("MH_WEATHER_FORECAST_DAYS", "2"))
WEATHER_TIMEOUT = int(os.getenv("MH_WEATHER_TIMEOUT", "30"))

# ---- LSTM forecaster ---------------------------------------------------
LSTM_WINDOW_HOURS = int(os.getenv("MH_LSTM_WINDOW_HOURS", "24"))
LSTM_HORIZON_HOURS = int(os.getenv("MH_LSTM_HORIZON_HOURS", "24"))
LSTM_HIDDEN = int(os.getenv("MH_LSTM_HIDDEN", "64"))
LSTM_LAYERS = int(os.getenv("MH_LSTM_LAYERS", "2"))
LSTM_EPOCHS = int(os.getenv("MH_LSTM_EPOCHS", "60"))
LSTM_LEARNING_RATE = float(os.getenv("MH_LSTM_LEARNING_RATE", "1e-3"))
LSTM_CACHE_TTL_SECONDS = float(os.getenv("MH_LSTM_CACHE_TTL_SECONDS", "600"))

# ---- Genetic Algorithm router -------------------------------------------
GA_GENERATIONS = int(os.getenv("MH_GA_GENERATIONS", "48"))
GA_POPULATION = int(os.getenv("MH_GA_POPULATION", "64"))
GA_ELITISM = int(os.getenv("MH_GA_ELITISM", "4"))
GA_CROSSOVER_RATE = float(os.getenv("MH_GA_CROSSOVER_RATE", "0.85"))
GA_MUTATION_RATE = float(os.getenv("MH_GA_MUTATION_RATE", "0.02"))
GA_TOURNAMENT_K = int(os.getenv("MH_GA_TOURNAMENT_K", "3"))
GA_POPULATION_DENSITY_PER_SQKM = int(os.getenv("MH_GA_POPULATION_DENSITY_PER_SQKM", "5200"))
GA_SHELTER_OVERRIDE = int(os.getenv("MH_GA_SHELTER_OVERRIDE", "0"))
GA_RESPONSE_UNIT_OVERRIDE = int(os.getenv("MH_GA_RESPONSE_UNIT_OVERRIDE", "0"))
GA_ROUTE_SPEED_KMH = float(os.getenv("MH_GA_ROUTE_SPEED_KMH", "24"))

# ---- Fusion pipeline ----------------------------------------------------
PIPELINE_CACHE_TTL = int(os.getenv("MH_PIPELINE_CACHE_TTL", "300"))

# ---- Service metadata ----------------------------------------------------
SERVICE_NAME = "multi-hazard-ml-backend"
SERVICE_VERSION = "1.0.0"
API_PREFIX = "/api/ml"

# ---- CORS ------------------------------------------------------------------
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "MH_ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:5000,https://multi-hazard-frontend.onrender.com,https://multi-hazard-backend.onrender.com",
    ).split(",")
]