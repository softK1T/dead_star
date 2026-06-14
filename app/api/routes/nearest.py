"""Pre-built KDTree for O(log n) nearest-star queries.

Built once at startup and stored on app.state.kdtree / app.state.hip_index.
"""
from __future__ import annotations

import math
import numpy as np
import pandas as pd
from scipy.spatial import KDTree


def build_kdtree(df: pd.DataFrame):
    """Return (kdtree, hip_array, xyz_array) for the given DataFrame."""
    ra  = np.radians(df["RAdeg"].values.astype(float))
    dec = np.radians(df["DEdeg"].values.astype(float))
    d   = df["distance_ly"].values.astype(float)

    x = d * np.cos(dec) * np.cos(ra)
    y = d * np.cos(dec) * np.sin(ra)
    z = d * np.sin(dec)

    xyz  = np.column_stack([x, y, z])
    mask = np.isfinite(xyz).all(axis=1)
    xyz  = xyz[mask]
    hips = df["HIP"].values[mask]
    idx  = df.index.values[mask]  # original DataFrame index

    return KDTree(xyz), hips, idx, xyz
