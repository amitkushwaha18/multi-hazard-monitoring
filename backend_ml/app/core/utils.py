# ============================================================
# Inference engine detection + shared numeric helpers.
# ============================================================
import math
from typing import Optional

from app import config


def torch_is_available() -> bool:
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


def yolo_is_available() -> bool:
    try:
        from ultralytics import YOLO  # noqa: F401
        return True
    except Exception:
        return False


def resolve_engine() -> str:
    mode = config.INFERENCE_ENGINE
    if mode == "torch":
        if not torch_is_available():
            raise RuntimeError("MH_INFERENCE_ENGINE=torch but torch is not installed.")
        return "torch"
    if mode == "numpy":
        return "numpy"
    return "torch" if torch_is_available() else "numpy"


def clamp(v: float, lo: float, hi: float) -> float:
    return min(hi, max(lo, v))


def sigmoid(x: float) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-clamp(x, -50, 50)))
    except OverflowError:
        return 1.0 if x > 0 else 0.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Real great-circle distance between two WGS84 coordinates (km)."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def percentile(values, q: float) -> float:
    """Linear-interpolated percentile for a list of floats."""
    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    k = (len(s) - 1) * q
    lo = int(math.floor(k))
    hi = int(math.ceil(k))
    frac = k - lo
    return s[lo] * (1 - frac) + s[hi] * frac


def zscore_scale(values):
    """Standardise a sequence to zero mean / unit std (real normalisation)."""
    if not values or len(values) < 2:
        return [0.0] * len(values)
    mu = sum(values) / len(values)
    var = sum((v - mu) ** 2 for v in values) / (len(values) - 1)
    std = math.sqrt(var) if var > 0 else 1.0
    return [(v - mu) / std for v in values]


def array_stats(values, keys=("min", "max", "mean", "p90")):
    if not values:
        return {k: None for k in keys}
    out = {"min": None, "max": None, "mean": None, "p90": None, "count": len(values)}
    out["min"] = float(min(values))
    out["max"] = float(max(values))
    out["mean"] = float(sum(values) / len(values))
    out["p90"] = float(percentile(values, 0.9))
    return out