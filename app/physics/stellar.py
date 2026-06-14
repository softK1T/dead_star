import numpy as np
import pandas as pd

L_SUN_ABS_MAG = 4.83
CURRENT_YEAR = 2026

# Minimum stellar mass to avoid division by zero / absurd t_life values
M_MIN = 0.08   # ~brown dwarf boundary
M_MAX = 150.0  # ~upper stellar mass limit


class StellarPhysics:
    def enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Guard: negative or near-zero parallax is unphysical
        df = df[df["Plx"] > 0.5].copy()  # Plx < 0.5 mas → dist > 2 kpc, unreliable

        df["distance_parsec"] = 1000.0 / df["Plx"]
        df["distance_ly"] = df["distance_parsec"] * 3.26156

        # Absolute magnitude
        df["M_V"] = df["Vmag"] - 5.0 * np.log10(df["distance_parsec"]) + 5.0

        # Luminosity in solar units
        df["L"] = 10.0 ** ((L_SUN_ABS_MAG - df["M_V"]) / 2.5)
        # Guard: unphysical luminosities (Vmag/distance errors)
        df["L"] = df["L"].clip(lower=1e-4, upper=1e7)

        # Mass from luminosity — piecewise power law
        df["M"] = self._mass(df["L"]).clip(lower=M_MIN, upper=M_MAX)

        # Main-sequence lifetime: t_MS = 1e10 / M^2.5  (years)
        # Floor at 1 Myr to avoid inf when M is huge
        df["t_life"] = (1e10 / (df["M"] ** 2.5)).clip(lower=1e6)

        # Year the light we see today left the star
        df["light_left_year"] = CURRENT_YEAR - df["distance_ly"].round().astype(int)

        return df

    @staticmethod
    def _mass(L: pd.Series) -> pd.Series:
        conditions = [L < 0.033, L < 16.0]
        choices    = [(L / 0.23) ** (1.0 / 2.3), L ** (1.0 / 4.0)]
        return np.select(conditions, choices, default=(L / 1.4) ** (1.0 / 3.5))
