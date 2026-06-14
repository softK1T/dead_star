from fastapi import APIRouter, HTTPException, Query, Request

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
    limit: int = Query(50, ge=1, le=5000),  # до 5000 за раз
):
    df = request.app.state.df

    if status:
        df = df[df["status"] == status]
    if search:
        df = df[df["HIP"].astype(str).str.contains(search, na=False)]

    total = len(df)
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
