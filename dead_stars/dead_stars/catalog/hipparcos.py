from astroquery.vizier import Vizier
import pandas as pd


class HipparcosLoader:
    COLUMNS = ["HIP", "RAdeg", "DEdeg", "Plx", "e_Plx", "SpType", "Vmag", "B-V", "F2"]

    def __init__(self, row_limit: int = 10000):
        self.row_limit = row_limit

    def load(self) -> pd.DataFrame:
        v = Vizier(columns=self.COLUMNS)
        v.ROW_LIMIT = self.row_limit
        result = v.get_catalogs("I/239/hip_main")
        return self._clean(result[0].to_pandas())

    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df[(df["F2"] < 3) & (df["Plx"] > 0)].copy()
        df = df.dropna(subset=["Vmag", "B-V"])
        return df.reset_index(drop=True)
