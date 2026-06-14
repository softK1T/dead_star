from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
import pandas as pd
import io
import math

router = APIRouter(prefix="/api")

COLUMNS = [
    "HIP", "SpType", "Vmag", "B-V", "M_V", "distance_ly",
    "light_left_year", "L", "M", "t_life", "t_age",
    "t_remaining_gyr", "status", "RAdeg", "DEdeg",
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
        sample = df if limit >= total else df.iloc[::max(1, total // limit)].head(limit)
        rows = sample[COLUMNS].fillna(value="").to_dict(orient="records")
        return {"data": rows, "total": total, "page": 1, "limit": len(rows)}

    start = (page - 1) * limit
    end = start + limit
    rows = df.iloc[start:end][COLUMNS].fillna(value="").to_dict(orient="records")
    return {"data": rows, "total": total, "page": page, "limit": limit}


@router.get("/stars/{hip_id}/nearest")
async def get_nearest(hip_id: int, request: Request, n: int = Query(5, ge=1, le=20)):
    df: pd.DataFrame = request.app.state.df
    target = df[df["HIP"] == hip_id]
    if target.empty:
        raise HTTPException(status_code=404, detail="Star not found")

    t = target.iloc[0]
    # Need 3D cartesian coords — compute from RA/Dec/distance if x/y/z not present
    def get_xyz(row):
        ra = row.get("RAdeg", None)
        de = row.get("DEdeg", None)
        dist = row.get("distance_ly", None)
        if ra is None or de is None or dist is None:
            return None, None, None
        try:
            ra_r = math.radians(float(ra))
            de_r = math.radians(float(de))
            d = float(dist)
            x = d * math.cos(de_r) * math.cos(ra_r)
            y = d * math.cos(de_r) * math.sin(ra_r)
            z = d * math.sin(de_r)
            return x, y, z
        except (ValueError, TypeError):
            return None, None, None

    # Check if x/y/z columns exist already
    has_xyz = all(c in df.columns for c in ["x", "y", "z"])

    if has_xyz:
        tx, ty, tz = float(t["x"]), float(t["y"]), float(t["z"])
        others = df[df["HIP"] != hip_id].copy()
        others = others.dropna(subset=["x", "y", "z"])
        others["_dist"] = (
            (others["x"] - tx) ** 2 +
            (others["y"] - ty) ** 2 +
            (others["z"] - tz) ** 2
        ) ** 0.5
    else:
        tx, ty, tz = get_xyz(t)
        if tx is None:
            raise HTTPException(status_code=422, detail="Target star has no coordinates")
        others = df[df["HIP"] != hip_id].copy()
        coords = others.apply(lambda r: pd.Series(get_xyz(r), index=["_x", "_y", "_z"]), axis=1)
        others = others.join(coords)
        valid = others.dropna(subset=["_x", "_y", "_z"])
        valid = valid.copy()
        valid["_dist"] = (
            (valid["_x"] - tx) ** 2 +
            (valid["_y"] - ty) ** 2 +
            (valid["_z"] - tz) ** 2
        ) ** 0.5
        others = valid

    nearest = others.nsmallest(n, "_dist")
    rows = nearest[COLUMNS].fillna(value="").to_dict(orient="records")
    return rows


@router.get("/stars/{hip_id}")
async def get_star(hip_id: int, request: Request):
    df: pd.DataFrame = request.app.state.df
    match = df[df["HIP"] == hip_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Star not found")
    return match.iloc[0][COLUMNS].fillna(value="").to_dict()


@router.get("/stats")
async def get_stats(request: Request):
    df: pd.DataFrame = request.app.state.df
    total = len(df)
    counts = df["status"].value_counts().to_dict()
    return {
        "total": total,
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
    df: pd.DataFrame = request.app.state.df.copy()

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
