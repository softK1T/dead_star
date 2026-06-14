import pandas as pd


class StarStatusClassifier:
    def classify(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        # t_remaining = how many years of MS life are left
        # t_age already accounts for the star's evolutionary state.
        # distance_ly (light travel time) is NOT subtracted here —
        # it is already captured in light_left_year for display purposes.
        df["t_remaining"] = df["t_life"] - df["t_age"]
        df["t_remaining_gyr"] = df["t_remaining"] / 1e9
        df["status"] = df["t_remaining"].apply(self._label)
        return df

    @staticmethod
    def _label(t: float) -> str:
        if pd.isna(t) or t < 0:
            return "likely dead"
        if t < 5e8:
            return "uncertain"
        return "alive"
