from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np
import io
import math

router = APIRouter(prefix="/api")

COLUMNS = [
    "HIP", "SpType", "Vmag", "B-V", "M_V", "distance_ly",
    "light_left_year", "L", "M", "t_life", "t_age",
    "t_remaining_gyr", "status", "RAdeg", "DEdeg",
]


def _safe_records(df: pd.DataFrame) -> list[dict]:
    """Serialize rows replacing NaN/Inf with None."""
    return [
        {k: (None if (isinstance(v, float) and not math.isfinite(v)) else v)
         for k, v in row.items()}
        for row in df.to_dict(orient="records")
    ]


@router.get("/stars")
async def get_stars(
    request: Request,
    status: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200000),
    map_mode: bool = Query(False),
    spectral_type: str | None = Query(None),
    dist_min: float | None = Query(None),
    dist_max: float | None = Query(None),
):
    df: pd.DataFrame = request.app.state.df

    if status:
        df = df[df["status"] == status]
    if search:
        df = df[df["HIP"].astype(str).str.contains(search, na=False)]
    if spectral_type:
        df = df[df["SpType"].astype(str).str.startswith(spectral_type, na=False)]
    if dist_min is not None:
        df = df[df["distance_ly"] >= dist_min]
    if dist_max is not None:
        df = df[df["distance_ly"] <= dist_max]

    total = len(df)

    if map_mode:
        sample = df if limit >= total else df.sample(n=limit, random_state=42)
        return {"data": _safe_records(sample[COLUMNS]), "total": total, "page": 1, "limit": len(sample)}

    start = (page - 1) * limit
    rows = _safe_records(df.iloc[start: start + limit][COLUMNS])
    return {"data": rows, "total": total, "page": page, "limit": limit}


@router.get("/stars/{hip_id}/nearest")
async def get_nearest(hip_id: int, request: Request, n: int = Query(5, ge=1, le=20)):
    df: pd.DataFrame = request.app.state.df
    target = df[df["HIP"] == hip_id]
    if target.empty:
        raise HTTPException(status_code=404, detail="Star not found")

    t = target.iloc[0]
    try:
        ra_r  = math.radians(float(t["RAdeg"]))
        de_r  = math.radians(float(t["DEdeg"]))
        d     = float(t["distance_ly"])
        tx    = d * math.cos(de_r) * math.cos(ra_r)
        ty    = d * math.cos(de_r) * math.sin(ra_r)
        tz    = d * math.sin(de_r)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Target star has no valid coordinates")

    tree      = request.app.state.kdtree
    kd_idx    = request.app.state.kd_idx
    # Query n+1 because the star itself may be in the tree
    dists, ii = tree.query([tx, ty, tz], k=min(n + 1, len(kd_idx)))
    # Filter out the target star itself
    result_idx = [kd_idx[i] for i in (ii if hasattr(ii, '__iter__') else [ii])
                  if df.iloc[kd_idx[i]]["HIP"] != hip_id][:n]

    return _safe_records(df.iloc[result_idx][COLUMNS])


@router.get("/stars/{hip_id}")
async def get_star(hip_id: int, request: Request):
    df: pd.DataFrame = request.app.state.df
    match = df[df["HIP"] == hip_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Star not found")
    row = match.iloc[0][COLUMNS].to_dict()
    return {k: (None if (isinstance(v, float) and not math.isfinite(v)) else v) for k, v in row.items()}


@router.get("/stats")
async def get_stats(request: Request):
    df: pd.DataFrame = request.app.state.df
    counts = df["status"].value_counts().to_dict()
    return {
        "total": len(df),
        "likely_dead": counts.get("likely dead", 0),
        "uncertain": counts.get("uncertain", 0),
        "alive": counts.get("alive", 0),
    }


@router.get("/export/csv")
async def export_csv(
    request: Request,
    status: str | None = Query(None),
    spectral_type: str | None = Query(None),
    dist_min: float | None = Query(None),
    dist_max: float | None = Query(None),
):
    df = request.app.state.df.copy()
    if status:
        df = df[df["status"] == status]
    if spectral_type:
        df = df[df["SpType"].astype(str).str.startswith(spectral_type, na=False)]
    if dist_min is not None:
        df = df[df["distance_ly"] >= dist_min]
    if dist_max is not None:
        df = df[df["distance_ly"] <= dist_max]

    export_cols = [c for c in COLUMNS if c in df.columns]
    buf = io.StringIO()
    df[export_cols].to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=dead_stars_export.csv"},
    )
