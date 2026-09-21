# Multi-Hazard Monitoring — Real ML Backend (FastAPI)

Production-ready Hybrid-AI backend that powers all ML-driven panels of the
dashboard. It interconnects three real sub-systems with no mock or seeded
output anywhere:

```
weather/hydrology telemetry (Open-Meteo + GloFAS)
          |
          v
     LSTM forecaster  -- floodRiskScore / dynamicWeight --\
          |                                                  \
     CNN vision       -- blockedRoadNodes / blockedRatio   )-->> GA evacuation router
     (drone/aerial)     fused risk + XAI feature attributions
```

## Quick start

```bash
cd backend_ml
python -m venv .venv
.venv\Scripts\activate            # Windows; source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt   # optional: pip install -r requirements-yolo.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/api/ml/health`

## API endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/ml/fusion` | GET | Full CNN + LSTM + GA pipeline fused into one risk report. Params: `lat`, `lng`, `city`. |
| `/api/ml/cnn/analyze` | POST | Analyse an uploaded aerial/damage image (multipart `file`, optional `lat`/`lng`). |
| `/api/ml/lstm/forecast` | GET | LSTM flood forecast + 24h history/forecast grid + XAI attributions. |
| `/api/ml/ga/optimize` | POST | Genetic-Algorithm evacuation routing given `cnn` + `lstm` state. |
| `/api/ml/health` | GET | Service + engine availability status. |

## Architecture

- **`app/services/weather.py`** — live hourly telemetry from Open-Meteo plus
  GloFAS river discharge (linearly-interpolated daily→hourly). Falls back to a
  documented soil-moisture proxy if GloFAS is unavailable.
- **`app/models/cnn_detector.py`** — real pixel-level computer vision
  (RGB water index, Canny/Hough road detection) producing weak labels that
  actually train the CNN; exposes structural integrity, flood submersion,
  flooded area and blocked road junctions.
- **`app/models/torch_cnn.py` / `numpy_cnn.py`** — the trained vision backbone
  (PyTorch primary, native NumPy fallback with full conv backprop).
- **`app/models/lstm_forecaster.py`** — genuine 2-layer LSTM trained on the
  live telemetry (PyTorch; NumPy full-BPTT offline fallback), multi-step
  forecast grid, flood risk score + dynamic weight, and input-gradient XAI.
- **`app/models/ga_router.py`** — evolutionary evacuation optimiser (roulette
  selection + two-point crossover + mutation + elitism) over the road-junction
  graph built by the CNN, constrained by the LSTM flood weight.
- **`app/services/fusion.py`** — orchestration + weighted fusion risk score.

## Configuration

All knobs read from environment variables with documented defaults (see
`app/config.py`). Key ones:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MH_INFERENCE_ENGINE` | `auto` | `auto` / `torch` / `numpy` inference engine. |
| `MH_IMAGERY_TILE_URL` | ESRI World Imagery | Keyless aerial tile source. |
| `MH_WEATHER_PAST_DAYS` | `15` | LSTM training window (hours of history). |
| `MH_LSTM_HORIZON_HOURS` | `24` | Forecast horizon fed to the dashboard. |
| `MH_GA_GENERATIONS` | `48` | GA evolution generations. |
| `MH_GA_POPULATION` | `64` | GA population size. |
| `MH_ALLOWED_ORIGINS` | localhost + Render | CORS origins (comma separated). |
| `MH_PIPELINE_CACHE_TTL` | `300` | Fusion cache TTL (seconds). |

RNG is only used for standard weight initialisation (documented seed) and the
GA's evolutionary operators — never to fabricate output values.

## Optional YOLOv8

`requirements-yolo.txt` (ultralytics) is auto-detected; when present the CNN
pipeline can use real YOLOv8 object detection in addition to the pixel-CV
measurements.