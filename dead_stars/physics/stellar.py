import numpy as np
import pandas as pd

L_SUN_ABS_MAG = 4.83
CURRENT_YEAR = 2026


class StellarPhysics:
    def enrich(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["distance_parsec"] = 1000 / df["Plx"]
        df["distance_ly"] = df["distance_parsec"] * 3.26156
        df["M_V"] = df["Vmag"] - 5 * np.log10(df["distance_parsec"]) + 5
        df["L"] = 10 ** ((L_SUN_ABS_MAG - df["M_V"]) / 2.5)
        df["M"] = self._mass(df["L"])
        df["t_life"] = 1e10 / (df["M"] ** 2.5)
        df["light_left_year"] = CURRENT_YEAR - df["distance_ly"].astype(int)
        return df

    @staticmethod
    def _mass(L: pd.Series) -> pd.Series:
        conditions = [L < 0.033, L < 16]
        choices = [(L / 0.23) ** (1 / 2.3), L ** (1 / 4)]
        return np.select(conditions, choices, default=(L / 1.4) ** (1 / 3.5))
