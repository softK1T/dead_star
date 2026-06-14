from fastapi import APIRouter, HTTPException, Query, Request
import pandas as pd

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
