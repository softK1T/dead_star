import numpy as np
import pandas as pd

L_SUN_ABS_MAG = 4.83
CURRENT_YEAR = 2026

M_MIN = 0.08
M_MAX = 150.0


class StellarPhysics:
    def enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Guard: parallax <= 0.5 mas → distance > 2 kpc, unreliable
        df = df[df["Plx"] > 0.5].copy()

        df["distance_parsec"] = 1000.0 / df["Plx"]
        df["distance_ly"]     = df["distance_parsec"] * 3.26156
        df["M_V"]             = df["Vmag"] - 5.0 * np.log10(df["distance_parsec"]) + 5.0

        # Luminosity — pd.Series, so .clip(lower=, upper=) is fine
        df["L"] = (10.0 ** ((L_SUN_ABS_MAG - df["M_V"]) / 2.5)).clip(lower=1e-4, upper=1e7)

        # Mass — np.select returns ndarray, must use np.clip
        M_arr   = self._mass(df["L"].values)
        df["M"] = pd.Series(np.clip(M_arr, M_MIN, M_MAX), index=df.index)

        # Main-sequence lifetime in years; floor at 1 Myr
        df["t_life"] = (1e10 / (df["M"] ** 2.5)).clip(lower=1e6)

        df["light_left_year"] = CURRENT_YEAR - df["distance_ly"].round().astype(int)
        return df

    @staticmethod
    def _mass(L: np.ndarray) -> np.ndarray:
        """Piecewise mass-luminosity. Input/output: numpy ndarray."""
        conditions = [L < 0.033, L < 16.0]
        choices    = [(L / 0.23) ** (1.0 / 2.3), L ** (1.0 / 4.0)]
        return np.select(conditions, choices, default=(L / 1.4) ** (1.0 / 3.5))
