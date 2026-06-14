from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.stars import router as stars_router
from app.catalog import HipparcosLoader
from app.classifier import StarStatusClassifier
from app.isochrones import IsochroneAgeEstimator
from app.physics import StellarPhysics

ISO_PATH = Path(__file__).resolve().parent.parent.parent / "iso.csv"


@asynccontextmanager
async def lifespan(app: FastAPI):
    df = HipparcosLoader(row_limit=10000).load()
    df = StellarPhysics().enrich(df)
    df = IsochroneAgeEstimator(str(ISO_PATH)).apply(df)
    df = StarStatusClassifier().classify(df)
    app.state.df = df
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
