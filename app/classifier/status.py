import numpy as np
import pandas as pd

# Spectral type prefixes that are definitively post-MS (giants, supergiants, WR, remnants)
_POST_MS_PREFIXES = (
    "WN", "WC", "WO", "WR",       # Wolf-Rayet
    "C-", "C ", "CN", "CH",        # Carbon stars (AGB)
    "S ", "MS",                    # S-type AGB
    "D",                           # White dwarfs (DA, DB, DC …)
    "sd",                          # Subdwarfs (post-MS evolution)
)
_GIANT_SUFFIXES = ("III", "II", "Ib", "Ia", "Iab", "0")  # luminosity class giants/supergiants


def _is_post_ms_sptype(sp: str) -> bool:
    """Return True if spectral type clearly indicates post-MS object."""
    if not isinstance(sp, str) or sp.strip() == "":
        return False
    sp = sp.strip()
    for prefix in _POST_MS_PREFIXES:
        if sp.startswith(prefix):
            return True
    for suffix in _GIANT_SUFFIXES:
        if suffix in sp:
            return True
    return False


class StarStatusClassifier:
    """
    Classify stars as 'likely dead', 'uncertain', or 'alive' based on
    multiple physical indicators:

    1. Spectral type  — giants/supergiants/WR/WD are post-MS
    2. Luminosity     — L > threshold for given colour means evolved
    3. Colour-magnitude position relative to MS turnoff
    4. t_life vs t_age (when t_age is reliable)
    """

    def classify(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        n = len(df)
        score = np.zeros(n, dtype=float)  # higher → more "dead"

        # ── Indicator 1: spectral type clearly post-MS ──
        sp_dead = df["SpType"].apply(_is_post_ms_sptype).values
        score += sp_dead.astype(float) * 3.0

        # ── Indicator 2: luminosity way above ZAMS for the mass ──
        # L_ZAMS ≈ M^4; giants have L >> L_ZAMS
        if "L" in df.columns and "M" in df.columns:
            L = df["L"].values.astype(float)
            M = df["M"].values.astype(float)
            L_zams = np.where(M > 0, M ** 4.0, np.nan)
            # Ratio > 2 → definitely off MS; > 10 → very evolved
            ratio = np.where(L_zams > 0, L / L_zams, np.nan)
            score += np.where(ratio > 10, 2.0, np.where(ratio > 2, 1.0, 0.0))

        # ── Indicator 3: red colour + high luminosity (red giant branch) ──
        if "B-V" in df.columns and "L" in df.columns:
            bv = df["B-V"].values.astype(float)
            L  = df["L"].values.astype(float)
            red_giant = (bv > 1.0) & (L > 10)
            score += red_giant.astype(float) * 2.0

        # ── Indicator 4: t_life vs t_age (if estimator gave a value) ──
        if "t_life" in df.columns and "t_age" in df.columns:
            t_life = df["t_life"].values.astype(float)
            t_age  = df["t_age"].values.astype(float)
            t_rem  = t_life - t_age
            score += np.where(np.isfinite(t_rem) & (t_rem < 0), 2.0, 0.0)
            score += np.where(np.isfinite(t_rem) & (t_rem >= 0) & (t_rem < 5e8), 0.5, 0.0)

        # ── Final classification ──
        # score >= 2 → likely dead, 0.5–1.9 → uncertain, < 0.5 → alive
        status = np.where(score >= 2.0, "likely dead",
                 np.where(score >= 0.5, "uncertain", "alive"))
        df["status"] = status

        # t_remaining: use t_life - t_age when available, else NaN
        if "t_life" in df.columns and "t_age" in df.columns:
            t_rem_arr = df["t_life"].values.astype(float) - df["t_age"].values.astype(float)
            # For confirmed dead (score >= 2) with positive t_remaining, force negative
            # so they appear left of NOW on the Timeline
            dead_mask = status == "likely dead"
            t_rem_arr = np.where(dead_mask & (t_rem_arr > 0), -np.abs(t_rem_arr) * 0.1, t_rem_arr)
        else:
            t_rem_arr = np.full(n, np.nan)

        df["t_remaining"]     = t_rem_arr
        df["t_remaining_gyr"] = t_rem_arr / 1e9
        return df
