import numpy as np
from backend.data.loader import generate_synthetic_dataset, get_profile_map


def test_profile_map_and_real_curve():
    df = generate_synthetic_dataset(n_profiles=3, n_cycles=30)
    profiles = get_profile_map(df)
    assert isinstance(profiles, dict)
    assert len(profiles) == 3
    for pid, arr in profiles.items():
        assert arr.dtype == np.float32
        assert arr.ndim == 1
        assert arr.size == 30
