import numpy as np
import pandas as pd
from scipy.spatial import KDTree
from sklearn.preprocessing import StandardScaler


class IsochroneAgeEstimator:
    ISO_COLUMNS = [
        "Zini", "MH", "logAge", "Mini", "int_IMF", "Mass",
        "logL", "logTe", "logg", "label", "McoreTP", "C_O",
        "period0", "period1", "period2", "period3", "period4",
        "pmode", "Mloss", "tau1m", "X", "Y", "Xc", "Xn", "Xo",
        "Cexcess", "Z", "mbolmag",
        "Umag", "Bmag", "Vmag", "Rmag", "Imag", "Jmag", "Hmag", "Kmag",
    ]

    def __init__(self, iso_path: str):
        self._iso_ms, self._tree, self._scaler = self._build(iso_path)

    def _build(self, path: str):
        iso = pd.read_csv(path, comment="#", sep=r"\s+", names=self.ISO_COLUMNS)
        iso_ms = iso[iso["label"] == 0].copy()
        iso_ms["B_V"] = iso_ms["Bmag"] - iso_ms["Vmag"]
        iso_ms["age_yr"] = 10 ** iso_ms["logAge"]
        iso_ms = iso_ms.dropna(subset=["B_V", "Vmag", "age_yr"]).reset_index(drop=True)

        scaler = StandardScaler()
        iso_scaled = scaler.fit_transform(iso_ms[["B_V", "Vmag"]].values)
        return iso_ms, KDTree(iso_scaled), scaler

    def estimate(self, bv: float, mv: float) -> float:
        if np.isnan(bv) or np.isnan(mv):
            return np.nan
        point = self._scaler.transform([[bv, mv]])
        _, idx = self._tree.query(point[0])
        return float(self._iso_ms.iloc[int(idx)]["age_yr"])

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["t_age"] = df.apply(lambda r: self.estimate(r["B-V"], r["M_V"]), axis=1)
        return df
