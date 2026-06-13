from dead_stars.catalog.hipparcos import HipparcosLoader
from dead_stars.physics.stellar import StellarPhysics
from dead_stars.isochrones.estimator import IsochroneAgeEstimator
from dead_stars.classifier.status import StarStatusClassifier

df = HipparcosLoader(row_limit=10000).load()
df = StellarPhysics().enrich(df)
df = IsochroneAgeEstimator("iso.csv").apply(df)
df = StarStatusClassifier().classify(df)

dead = df[df["status"] == "likely dead"]
print(dead[[
    "HIP", "SpType", "distance_ly", "light_left_year",
    "B-V", "L", "M", "t_life", "t_age", "t_remaining_gyr", "status"
]].head(100))
