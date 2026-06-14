import numpy as np
import pandas as pd

# Physics-based stellar age estimation.
#
# The old KDTree/isochrone approach returned the same value (~1e9 yr) for almost
# all stars because the isochrone grid only covered a narrow logAge range and the
# nearest-neighbour lookup collapsed to a single point.
#
# New approach: estimate the fractional age on the Main Sequence from a star's
# luminosity relative to empirical ZAMS/TAMS luminosities for its mass.
#
#   age_fraction ≈ (L_obs - L_ZAMS(M)) / (L_TAMS(M) - L_ZAMS(M))
#
# L_ZAMS ≈ M^4  (classic mass-luminosity relation)
# L_TAMS ≈ M^4 * k  where k=2.0 for M<2 M☉, k=1.6 for massive stars
# Result clamped to [0.05, 0.95] to avoid degenerate values.
#
# t_age = age_fraction * t_life


class IsochroneAgeEstimator:
    """Estimates stellar age from luminosity relative to ZAMS/TAMS."""

    def __init__(self, iso_path: str = ""):
        # iso_path kept for API compatibility but no longer used
        pass

    def estimate_fraction(self, L: float, M: float) -> float:
        """Return fractional MS age in [0.05, 0.95] for given L and M."""
        if np.isnan(L) or np.isnan(M) or M <= 0 or L <= 0:
            return np.nan

        L_zams = M ** 4.0
        k_tams = 2.0 if M < 2.0 else 1.6
        L_tams = L_zams * k_tams

        denom = L_tams - L_zams
        if denom <= 0:
            return np.nan

        frac = (L - L_zams) / denom
        return float(np.clip(frac, 0.05, 0.95))

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        if "t_life" not in df.columns or "L" not in df.columns or "M" not in df.columns:
            df["t_age"] = np.nan
            return df

        fractions = df.apply(
            lambda r: self.estimate_fraction(r["L"], r["M"]), axis=1
        )
        df["t_age"] = fractions * df["t_life"]
        return df
