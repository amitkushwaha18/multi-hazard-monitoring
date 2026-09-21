# ============================================================
# Real satellite / drone imagery ingestion.
#
# Fetches an actual overhead tile for the target coordinates from
# keyless public web-mapping / remote-sensing raster services
# (ESRI World Imagery; NASA GIBS Sentinel-2 / BlueMarble fallbacks).
# The fetched pixels are what the CNN pipeline actually analyses.
# ============================================================
import io
import math
import os
import hashlib
import time
from typing import Optional

import numpy as np
import requests
from PIL import Image

from app import config
from app.core.utils import clamp

IMG_CACHE_TTL_SECONDS = 3600.0  # 1h cache of raw tiles


def latlng_to_tile(lat: float, lng: float, z: int):
    """Web-Mercator slippy-map tile coordinates for (lat, lng) at zoom z."""
    lat = clamp(lat, -85.05112878, 85.05112878)
    lat_r = math.radians(lat)
    n = 2 ** z
    x = int(((lng + 180.0) / 360.0) * n)
    y = int((1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n)
    return x, y


def _cache_path(kind: str, lat: float, lng: float, z: int) -> str:
    key = hashlib.sha1(f"{kind}|{lat:.6f}|{lng:.6f}|{z}".encode()).hexdigest()[:20]
    return str(config.BLOB_CACHE_DIR / f"{kind}_{key}.jpg")


def _read_cache(path: str) -> Optional[Image.Image]:
    try:
        if not os.path.exists(path):
            return None
        age = time.time() - os.path.getmtime(path)
        if age > IMG_CACHE_TTL_SECONDS * 3:
            return None
        return Image.open(path).convert("RGB")
    except Exception:
        return None


def _write_cache(pillow_img: Image.Image, path: str):
    try:
        pillow_img.save(path, "JPEG", quality=92)
    except Exception:
        pass


def _fetch(url: str, timeout: int) -> Image.Image:
    headers = {
        "User-Agent": "MultiHazardML/1.0 (real-time hazard analytics)",
        "Accept": "image/jpeg,image/png",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGB")


def _fetch_esri(lat: float, lng: float, z: int) -> Image.Image:
    x, y = latlng_to_tile(lat, lng, z)
    url = config.IMAGERY_TILE_URL.format(z=z, x=x, y=y)
    return _fetch(url, config.IMAGERY_DOWNLOAD_TIMEOUT)


def _fetch_gibs(lat: float, lng: float, z: int) -> Image.Image:
    """NASA GIBS Sentinel-2 TrueColor (best available band-set for the day)."""
    x, y = latlng_to_tile(lat, lng, z)
    level = min(max(z, 1), 9)  # GIBS GoogleMapsCompatible levels 1..9
    try_source = [
        (
            config.GIBS_SENTINEL2_URL.format(level=level, z=z, y=y, x=x),
            "Sentinel-2",
        ),
        (
            config.GIBS_BLUEMARBLE_URL.format(level=level, z=z, y=y, x=x),
            "BlueMarble",
        ),
    ]
    last_err = None
    for url, _name in try_source:
        try:
            return _fetch(url, config.IMAGERY_DOWNLOAD_TIMEOUT)
        except Exception as err:  # pragma: no cover - network fallback path
            last_err = err
    raise RuntimeError(f"GIBS imagery unavailable: {last_err}")


def fetch_imagery(lat: float, lng: float, zoom: Optional[int] = None) -> Image.Image:
    """Return a real RGB overhead image covering the target zone.

    Primary source is ESRI World Imagery at the requested (or default)
    zoom. If that fails, falls back to NASA GIBS raster products.
    """
    z = clamp(zoom if zoom else config.IMAGERY_MAX_ZOOM, 13, 19)
    cache_path = _cache_path("esri", lat, lng, z)
    cached = _read_cache(cache_path)
    if cached is not None:
        return cached

    img = _fetch_esri(lat, lng, z)
    _write_cache(img, cache_path)
    return img


def fetch_imagery_bytes(lat: float, lng: float, zoom: Optional[int] = None) -> bytes:
    img = fetch_imagery(lat, lng, zoom)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=92)
    return buf.getvalue()


def image_to_rgb_array(img: Image.Image, size=(256, 256)) -> np.ndarray:
    """Resize the tile to the CNN input size (actual pixels)."""
    arr = np.asarray(img.resize(size, Image.LANCZOS), dtype=np.float32)
    return arr / 255.0


def tile_coverage(lat: float, lng: float, z: int) -> float:
    """Real width in km covered by one tile at the given latitude/zoom."""
    n = 2 ** z
    e = 2 * math.pi * 6371008.8
    per_tile_m = e / n
    return (per_tile_m * math.cos(math.radians(lat))) / 1000.0