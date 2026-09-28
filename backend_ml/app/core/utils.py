# ============================================================
# Inference engine detection + shared numeric helpers.
# ============================================================
import math
from typing import Optional

from app import config


def torch_is_available() -> bool:
    if config.LOW_MEMORY_MODE:
        # Never import torch under 512MB constraints - the import alone
        # can push RSS over the limit before any inference even runs.
        return False
    try:
        import torch  # noqa: F401
        return True
    except Exception:
        return False


def yolo_is_available() -> bool:
    if config.LOW_MEMORY_MODE:
        # ultralytics pulls in torch + downloads weights; skip entirely.
        return False
    try:
        from ultralytics import YOLO  # noqa: F401
        return True
    except Exception:
        return False


def resolve_engine() -> str:
    if config.LOW_MEMORY_MODE:
        return "numpy"
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


def piecewise_linear(x: float, steps) -> float:
    """Map x onto 0-100 via non-decreasing piecewise linear interpolation
    over (threshold, value) steps. Bounds are clamped.
    """
    if not steps:
        return 0.0
    # Sort steps by threshold
    s = sorted(steps, key=lambda p: p[0])
    if x <= s[0][0]:
        return clamp(float(s[0][1]), 0.0, 100.0)
    if x >= s[-1][0]:
        return clamp(float(s[-1][1]), 0.0, 100.0)
    for i in range(1, len(s)):
        if s[i - 1][0] <= x <= s[i][0]:
            x0, y0 = s[i - 1]
            x1, y1 = s[i]
            if x1 == x0:
                return clamp(float(y1), 0.0, 100.0)
            t = (x - x0) / (x1 - x0)
            v = y0 + t * (y1 - y0)
            return clamp(float(v), 0.0, 100.0)
    return clamp(float(s[-1][1]), 0.0, 100.0)


def array_stats(values, keys=("min", "max", "mean", "p90")):
    if not values:
        return {k: None for k in keys}
    out = {"min": None, "max": None, "mean": None, "p90": None, "count": len(values)}
    out["min"] = float(min(values))
    out["max"] = float(max(values))
    out["mean"] = float(sum(values) / len(values))
    out["p90"] = float(percentile(values, 0.9))
    return out
