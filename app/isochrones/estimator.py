import numpy as np
import pandas as pd

# Physics-based stellar age estimation.
#
# age_fraction = (L_obs - L_ZAMS) / (L_TAMS - L_ZAMS)  clamped to [0.05, 0.95]
#
# L_ZAMS(M) = M^4
# L_TAMS(M) = M^4 * k,  k=2.0 for M<2, k=1.6 for massive stars
#
# Special cases:
#   L < L_ZAMS  → star is sub-luminous for its mass (giant/pre-MS) → fraction = 0.95
#                 (treat as near end-of-life so t_remaining < 0 → "likely dead")
#   L >> L_TAMS → star is post-MS → fraction = 0.95


class IsochroneAgeEstimator:
    def __init__(self, iso_path: str = ""):
        pass  # iso_path kept for API compatibility

    def estimate_fraction(self, L: float, M: float) -> float:
        if not np.isfinite(L) or not np.isfinite(M) or M <= 0 or L <= 0:
            return np.nan

        L_zams = M ** 4.0
        k_tams = 2.0 if M < 2.0 else 1.6
        L_tams = L_zams * k_tams
        denom = L_tams - L_zams

        if denom <= 0:
            return np.nan

        frac = (L - L_zams) / denom

        # Stars brighter than TAMS or sub-luminous → evolved / off MS
        if frac >= 1.0 or frac < 0:
            return 0.97  # marks as near/past end → t_age ≈ t_life → t_remaining ≈ 0 or negative

        return float(np.clip(frac, 0.05, 0.95))

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if not all(c in df.columns for c in ("t_life", "L", "M")):
            df["t_age"] = np.nan
            return df

        fractions = df.apply(lambda r: self.estimate_fraction(r["L"], r["M"]), axis=1)
        df["t_age"] = fractions * df["t_life"]
        return df
