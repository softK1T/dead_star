import numpy as np
import pandas as pd

# Estimate stellar age from HR-diagram position.
#
# For MS stars: age_fraction = (L - L_ZAMS) / (L_TAMS - L_ZAMS), clamped [0.05, 0.92]
# For evolved stars (frac >= 1 or < 0): t_age is set to t_life (age = lifespan)
# so t_remaining = 0, and the score-based classifier handles the dead/uncertain label.


class IsochroneAgeEstimator:
    def __init__(self, iso_path: str = ""):
        pass

    def estimate_fraction(self, L: float, M: float) -> float:
        if not np.isfinite(L) or not np.isfinite(M) or M <= 0 or L <= 0:
            return np.nan

        L_zams = M ** 4.0
        k_tams = 2.0 if M < 2.0 else 1.6
        L_tams = L_zams * k_tams
        denom  = L_tams - L_zams
        if denom <= 0:
            return np.nan

        frac = (L - L_zams) / denom

        # Evolved / off-MS: return 1.0 so t_age = t_life → t_remaining = 0
        if not np.isfinite(frac) or frac >= 1.0 or frac < 0:
            return 1.0

        return float(np.clip(frac, 0.05, 0.92))

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if not all(c in df.columns for c in ("t_life", "L", "M")):
            df["t_age"] = np.nan
            return df
        fractions  = df.apply(lambda r: self.estimate_fraction(r["L"], r["M"]), axis=1)
        df["t_age"] = fractions * df["t_life"]
        return df
