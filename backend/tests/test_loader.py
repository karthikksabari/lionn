import numpy as np
import pandas as pd
from backend.data import loader


def test_synthetic_curve_length_and_range():
    n = 50
    arr = loader.synthetic_curve(n, seed=123)
    assert isinstance(arr, np.ndarray)
    assert arr.shape[0] == n
    assert np.all(arr >= 0.0) and np.all(arr <= 1.0)


def test_generate_synthetic_dataset_shape_and_profiles():
    df = loader.generate_synthetic_dataset(n_profiles=3, n_cycles=10, seed=7)
    assert isinstance(df, pd.DataFrame)
    assert df.shape[0] == 3 * 10
    assert "profile_id" in df.columns
    profiles = df["profile_id"].unique()
    assert len(profiles) == 3
