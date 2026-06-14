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
    limit: int = Query(50, ge=1, le=5000),
    map_mode: bool = Query(False),
):
    df = request.app.state.df

    if status:
        df = df[df["status"] == status]
    if search:
        df = df[df["HIP"].astype(str).str.contains(search, na=False)]

    total = len(df)

    if map_mode and not status:
        # balanced sample: equal share per status for the 3D map
        per_status = limit // 3
        frames = []
        for s in ["alive", "likely dead", "uncertain"]:
            chunk = df[df["status"] == s]
            if len(chunk) > per_status:
                chunk = chunk.sample(per_status, random_state=42)
            frames.append(chunk)
        df_map = pd.concat(frames)
        rows = df_map[COLUMNS].fillna(value="").to_dict(orient="records")
        return {"data": rows, "total": total, "page": 1, "limit": limit}

    start = (page - 1) * limit
    end = start + limit
    rows = df.iloc[start:end][COLUMNS].fillna(value="").to_dict(orient="records")
    return {"data": rows, "total": total, "page": page, "limit": limit}


@router.get("/stars/{hip_id}")
async def get_star(hip_id: int, request: Request):
    df = request.app.state.df
    match = df[df["HIP"] == hip_id]
    if match.empty:
        raise HTTPException(status_code=404, detail="Star not found")
    return match.iloc[0][COLUMNS].fillna(value="").to_dict()


@router.get("/stats")
async def get_stats(request: Request):
    df = request.app.state.df
    total = len(df)
    counts = df["status"].value_counts().to_dict()
    return {
        "total": total,
        "likely_dead": counts.get("likely dead", 0),
        "uncertain": counts.get("uncertain", 0),
        "alive": counts.get("alive", 0),
    }
