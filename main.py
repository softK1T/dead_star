from pathlib import Path

from app.catalog import HipparcosLoader
from app.classifier import StarStatusClassifier
from app.isochrones import IsochroneAgeEstimator
from app.physics import StellarPhysics

ISO_PATH = Path(__file__).resolve().parent / "iso.csv"

# row_limit=-1 loads the full Hipparcos catalog (~118 000 stars)
df = HipparcosLoader(row_limit=-1).load()
df = StellarPhysics().enrich(df)
df = IsochroneAgeEstimator(str(ISO_PATH)).apply(df)
df = StarStatusClassifier().classify(df)

dead = df[df["status"] == "likely dead"]
print(dead[[
    "HIP", "SpType", "distance_ly", "light_left_year",
    "B-V", "L", "M", "t_life", "t_age", "t_remaining_gyr", "status"
]].head(100))
