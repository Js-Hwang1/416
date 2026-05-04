import os
import time
import zipfile

import numpy as np
from shapely import set_precision

from .deps import HAS_LOWESS, HAS_SCIPY
from .paths import TMP_DIR


def unzip(zip_path, dest_name):
    """Unzip a file into TMP_DIR/dest_name and return the directory path."""
    dest = os.path.join(TMP_DIR, dest_name)
    if not os.path.exists(dest):
        os.makedirs(dest, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(dest)
    return dest


def find_shapefile(directory):
    """Find the first .shp file inside a directory tree."""
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith(".shp"):
                return os.path.join(root, f)
    raise FileNotFoundError(f"No .shp file found in {directory}")


def report(msg):
    print(f"  {msg}")


def timed(label):
    """Context manager that prints `label: <elapsed>s` on exit."""
    class Timer:
        def __enter__(self):
            self.t0 = time.time()
            return self

        def __exit__(self, *args):
            elapsed = time.time() - self.t0
            report(f"{label}: {elapsed:.1f}s")
    return Timer()


def reduce_precision(gdf, grid_size=1e-6):
    """Snap coordinates to grid for smaller file sizes (~11cm accuracy)."""
    gdf = gdf.copy()
    gdf["geometry"] = gdf["geometry"].apply(
        lambda g: set_precision(g, grid_size) if g is not None else g
    )
    return gdf


def lowess_or_spline(x, y, n_points=200):
    """Fit a smooth curve through (x, y) scatter; returns (x_fit, y_fit).

    Tries statsmodels LOWESS first, then scipy UnivariateSpline.
    """
    order = np.argsort(x)
    xs, ys = x[order], y[order]
    x_fit = np.linspace(xs.min(), xs.max(), n_points)

    if HAS_LOWESS:
        from statsmodels.nonparametric.smoothers_lowess import lowess as sm_lowess
        result = sm_lowess(ys, xs, frac=0.3, return_sorted=True)
        y_fit = np.interp(x_fit, result[:, 0], result[:, 1])
    elif HAS_SCIPY:
        from scipy.interpolate import UnivariateSpline
        try:
            spl = UnivariateSpline(xs, ys, s=len(xs) * 0.1, k=3)
            y_fit = spl(x_fit)
        except Exception:
            y_fit = np.interp(x_fit, xs, ys)
    else:
        y_fit = np.interp(x_fit, xs, ys)

    return x_fit, np.clip(y_fit, 0, 1)
