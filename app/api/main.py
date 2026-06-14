from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.stars import router as stars_router
from app.api.routes.nearest import build_kdtree
from app.catalog import HipparcosLoader
from app.classifier import StarStatusClassifier
from app.isochrones import IsochroneAgeEstimator
from app.physics import StellarPhysics

ISO_PATH = Path(__file__).resolve().parent.parent.parent / "iso.csv"


@asynccontextmanager
async def lifespan(app: FastAPI):
    df = HipparcosLoader(row_limit=-1).load()
    df = StellarPhysics().enrich(df)
    df = IsochroneAgeEstimator(str(ISO_PATH)).apply(df)
    df = StarStatusClassifier().classify(df)
    df = df.reset_index(drop=True)  # ensure clean integer index

    # Build KDTree once for O(log n) nearest-neighbour queries
    tree, hips, orig_idx, xyz = build_kdtree(df)
    app.state.df        = df
    app.state.kdtree    = tree
    app.state.kd_hips   = hips
    app.state.kd_idx    = orig_idx
    app.state.kd_xyz    = xyz
    yield
    app.state.df = None


app = FastAPI(title="Dead Stars API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stars_router)
