"""Data layer: raw loading (NASA .mat or synthetic fallback) and preprocessing."""

import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MinMaxScaler

FEATURE_COLS = ["cycle", "c_rate", "temperature"]
TARGET_COL = "soh"

BACKEND_DIR = Path(__file__).resolve().parents[1]
RAW_DIR = BACKEND_DIR / "data" / "raw"
PROCESSED_DIR = BACKEND_DIR / "data" / "processed"
SCALER_PATH = PROCESSED_DIR / "scaler.pkl"

RATED_CAPACITY_AH = 2.0
SYNTHETIC_SEED = 42


def generate_synthetic_dataset(
    n_profiles: int = 8,
    n_cycles: int = 200,
    seed: int = SYNTHETIC_SEED,
) -> pd.DataFrame:
    """Battery-like SOH curves: soh(cycle) = exp(-decay_rate * cycle) + noise."""
    rng = np.random.default_rng(seed)
    frames = []
    for i in range(n_profiles):
        decay_rate = rng.uniform(0.003, 0.006)
        c_rate = float(rng.uniform(0.5, 2.0))
        temperature = float(rng.uniform(10.0, 40.0))
        cycles = np.arange(1, n_cycles + 1, dtype=np.float32)
        noise = rng.normal(0.0, 0.005, size=n_cycles)
        soh = np.exp(-decay_rate * cycles) + noise
        frames.append(
            pd.DataFrame(
                {
                    "profile_id": f"SYNTH_{i:03d}",
                    "cycle": cycles,
                    "c_rate": c_rate,
                    "temperature": temperature,
                    "soh": np.clip(soh, 0.0, 1.0),
                }
            )
        )
    return pd.concat(frames, ignore_index=True)


def synthetic_curve(n_cycles: int, seed: int = SYNTHETIC_SEED) -> np.ndarray:
    """Reference exponential decay curve used as the fallback "real" series."""
    rng = np.random.default_rng(seed)
    decay_rate = rng.uniform(0.003, 0.006)
    cycles = np.arange(1, n_cycles + 1, dtype=np.float32)
    noise = rng.normal(0.0, 0.005, size=n_cycles)
    return np.clip(np.exp(-decay_rate * cycles) + noise, 0.0, 1.0)


def load_nasa_mat(path: str | os.PathLike, rated_capacity: float = RATED_CAPACITY_AH) -> pd.DataFrame:
    """Load a NASA battery .mat file, keeping discharge cycles only."""
    from scipy.io import loadmat  # imported lazily: only needed for real .mat files

    path = Path(path)
    mat = loadmat(str(path), simplify_cells=True)
    profile_id = path.stem
    battery = mat[profile_id] if profile_id in mat else next(
        v for k, v in mat.items() if not k.startswith("__")
    )
    cycles = battery["cycle"]
    if isinstance(cycles, dict):
        cycles = [cycles]

    rows = []
    cycle_idx = 0
    for entry in cycles:
        if str(entry.get("type", "")).lower() != "discharge":
            continue
        cycle_idx += 1
        data = entry.get("data", {})
        capacity = np.atleast_1d(data.get("Capacity", np.nan)).astype(float)
        if capacity.size == 0 or not np.isfinite(capacity[0]):
            continue
        current = np.atleast_1d(data.get("Current_measured", np.nan)).astype(float)
        temperature = np.atleast_1d(data.get("Temperature_measured", np.nan)).astype(float)
        c_rate = float(np.nanmean(np.abs(current))) / rated_capacity if current.size else 1.0
        rows.append(
            {
                "profile_id": profile_id,
                "cycle": float(cycle_idx),
                "c_rate": c_rate,
                "temperature": float(np.nanmean(temperature)) if temperature.size else float(entry.get("ambient_temperature", 24.0)),
                "soh": float(np.clip(capacity[0] / rated_capacity, 0.0, 1.0)),
            }
        )
    return pd.DataFrame(rows, columns=["profile_id", *FEATURE_COLS, TARGET_COL])


def load_all_raw() -> pd.DataFrame:
    """Load every .mat file in raw/, falling back to synthetic data when empty."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    mat_files = sorted(RAW_DIR.glob("*.mat"))
    if not mat_files:
        print(f"[loader] no .mat files in {RAW_DIR} -> using synthetic dataset")
        return generate_synthetic_dataset()

    frames = []
    for mat_file in mat_files:
        try:
            df = load_nasa_mat(mat_file)
        except Exception as exc:  # noqa: BLE001 - a bad file must not kill the run
            print(f"[loader] failed to parse {mat_file.name}: {exc}")
            continue
        if not df.empty:
            frames.append(df)
    if not frames:
        print("[loader] no usable discharge cycles found -> using synthetic dataset")
        return generate_synthetic_dataset()
    print(f"[loader] loaded {len(frames)} battery file(s) from {RAW_DIR}")
    return pd.concat(frames, ignore_index=True)


def preprocess(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42):
    """Split 80/20, fit the scaler on train only, persist scaler and arrays."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    X = df[FEATURE_COLS].to_numpy(dtype=np.float32)
    y = df[[TARGET_COL]].to_numpy(dtype=np.float32)

    X_train_raw, X_test_raw, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, shuffle=True
    )

    scaler = MinMaxScaler()
    X_train = scaler.fit_transform(X_train_raw).astype(np.float32)
    X_test = scaler.transform(X_test_raw).astype(np.float32)

    joblib.dump(scaler, SCALER_PATH)
    np.save(PROCESSED_DIR / "X_train.npy", X_train)
    np.save(PROCESSED_DIR / "X_test.npy", X_test)
    np.save(PROCESSED_DIR / "y_train.npy", y_train)
    np.save(PROCESSED_DIR / "y_test.npy", y_test)

    return X_train, X_test, y_train, y_test, scaler


def load_scaler() -> MinMaxScaler:
    return joblib.load(SCALER_PATH)


def load_processed():
    return (
        np.load(PROCESSED_DIR / "X_train.npy"),
        np.load(PROCESSED_DIR / "X_test.npy"),
        np.load(PROCESSED_DIR / "y_train.npy"),
        np.load(PROCESSED_DIR / "y_test.npy"),
    )


def simulate_degradation_ode(c_rate: float, temperature: float, n_cycles: int) -> np.ndarray:
    """Solve the SOH degradation ODE numerically using Euler integration.

    Equation: dSOH/d(cycle) = -degradation_rate * SOH
    Analytical solution: SOH(cycle) = SOH_0 * exp(-degradation_rate * cycle)
    """
    temp_kelvin = temperature + 273.15
    base_temp_kelvin = 298.15
    # Arrhenius thermodynamic factor
    arrhenius = np.exp((5000.0 / 8.314) * (1.0 / base_temp_kelvin - 1.0 / temp_kelvin))
    c_rate_mult = c_rate ** 1.15
    degradation_rate = 0.00032 * arrhenius * c_rate_mult

    soh = []
    current_soh = 1.0
    for _ in range(1, n_cycles + 1):
        # Euler step: dSOH = -degradation_rate * current_soh
        current_soh += -degradation_rate * current_soh
        soh.append(max(0.05, current_soh))
    return np.array(soh, dtype=np.float64)


def get_profile_label(c_rate: float, temp: float) -> str:
    """Generate a descriptive human-readable label based on c_rate and temperature."""
    if temp < 5:
        temp_str = "Sub-Zero" if temp < 0 else "Cold"
    elif temp > 40:
        temp_str = "High-Temp"
    else:
        temp_str = "Nominal"

    if c_rate > 2.5:
        c_str = "Fast Charge"
    elif c_rate > 1.5:
        c_str = "High Current"
    else:
        c_str = "Standard"

    return f"{temp_str} {c_str} Profile ({c_rate:.1f}C, {temp:.1f}°C)"

