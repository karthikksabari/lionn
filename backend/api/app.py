"""FastAPI service exposing SOH predictions from all three models."""

import logging

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.data.loader import (
    FEATURE_COLS,
    TARGET_COL,
    load_all_raw,
    load_scaler,
    synthetic_curve,
    simulate_degradation_ode,
    get_profile_label,
)
from backend.models import baseline_a, pinn
from backend.utils.metrics import evaluate_all

logger = logging.getLogger("battery_api")
logging.basicConfig(level=logging.INFO)

CYCLE_COL_IDX = FEATURE_COLS.index("cycle")

app = FastAPI(title="Battery Health Predictor", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE: dict = {"scaler": None, "models": {}, "raw": None}


class PredictRequest(BaseModel):
    profile_id: str | None = Field(None, description="Optional profile ID from the dataset")
    c_rate: float = Field(..., ge=0.1, le=5.0)
    temperature: float = Field(..., ge=-20.0, le=60.0)
    n_cycles: int = Field(100, ge=10, le=500)


class ModelMetrics(BaseModel):
    mae: float
    rmse: float


class PredictResponse(BaseModel):
    cycles: list[int]
    real: list[float]
    baseline_a: list[float]
    pinn: list[float]
    metrics: dict[str, ModelMetrics]
    violations: dict[str, int]
    ground_truth_type: str
    warning: str | None = None


class ProfileInfo(BaseModel):
    profile_id: str
    label: str
    c_rate: float
    temperature: float
    max_cycles: int
    split: str


class ProfilesResponse(BaseModel):
    profiles: list[ProfileInfo]


@app.on_event("startup")
def load_artifacts() -> None:
    try:
        STATE["scaler"] = load_scaler()
    except Exception as exc:  # noqa: BLE001 - missing artifacts must not crash startup
        logger.warning("scaler not loaded (%s); run `python -m scripts.train`", exc)

    for key, module in (("baseline_a", baseline_a), ("pinn", pinn)):
        try:
            STATE["models"][key] = (module, module.load())
        except Exception as exc:  # noqa: BLE001
            logger.warning("model %s not loaded (%s); run `python -m scripts.train`", key, exc)

    try:
        STATE["raw"] = load_all_raw()
    except Exception as exc:  # noqa: BLE001
        logger.warning("raw dataset unavailable (%s)", exc)


def models_loaded() -> bool:
    return STATE["scaler"] is not None and len(STATE["models"]) == 2


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "models_loaded": models_loaded()}


@app.get("/profiles", response_model=ProfilesResponse)
def get_profiles() -> dict:
    df = STATE["raw"]
    if df is None:
        try:
            STATE["raw"] = load_all_raw()
            df = STATE["raw"]
        except Exception as exc:
            logger.error("Failed to load raw profiles: %s", exc)
            return {"profiles": []}

    if df is None or df.empty:
        return {"profiles": []}

    # Static train/test split map for known profiles
    split_map = {
        "B0005": "train",
        "NASA_B0005": "train",
        "B0006": "train",
        "NASA_B0006": "train",
        "B0007": "test",
        "NASA_B0007": "test",
        "B0018": "test",
        "NASA_B0018": "test",
    }

    # Group by profile_id and find the first c_rate and temperature, and max cycle count
    grouped = df.groupby("profile_id").agg({
        "c_rate": "first",
        "temperature": "first",
        "cycle": "max"
    }).reset_index()

    # Sort alphabetically by profile_id
    grouped = grouped.sort_values("profile_id")
    unique_profiles = grouped["profile_id"].tolist()

    profiles_list = []
    for _, row in grouped.iterrows():
        pid = str(row["profile_id"])
        c_rate = float(row["c_rate"])
        temp = float(row["temperature"])
        max_cycles = int(row["cycle"])

        # Determine split
        if pid in split_map:
            split = split_map[pid]
        else:
            if len(unique_profiles) <= 1:
                split = "train"
            else:
                n_test = max(1, len(unique_profiles) // 4)
                pid_idx = unique_profiles.index(pid)
                split = "test" if pid_idx >= len(unique_profiles) - n_test else "train"

        label = get_profile_label(c_rate, temp)
        profiles_list.append({
            "profile_id": pid,
            "label": label,
            "c_rate": round(c_rate, 4),
            "temperature": round(temp, 4),
            "max_cycles": max_cycles,
            "split": split
        })

    return {"profiles": profiles_list}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> dict:
    warning_msg = None
    scaler = STATE["scaler"]
    if scaler is not None and hasattr(scaler, "data_min_") and hasattr(scaler, "data_max_"):
        c_rate_min, c_rate_max = float(scaler.data_min_[1]), float(scaler.data_max_[1])
        temp_min, temp_max = float(scaler.data_min_[2]), float(scaler.data_max_[2])
        logger.info(
            "Request inputs: c_rate=%.4f (trained: [%.4f, %.4f]), temp=%.4f (trained: [%.4f, %.4f])",
            req.c_rate, c_rate_min, c_rate_max, req.temperature, temp_min, temp_max
        )
        if req.c_rate < c_rate_min or req.c_rate > c_rate_max or req.temperature < temp_min or req.temperature > temp_max:
            warning_msg = (
                f"Extrapolation warning: Requested conditions (C-rate: {req.c_rate:.2f}C, Temp: {req.temperature:.1f}°C) "
                f"are outside the model's trained range (C-rate: [{c_rate_min:.2f}, {c_rate_max:.2f}], Temp: [{temp_min:.1f}, {temp_max:.1f}]). "
                "Extrapolation predictions may be unreliable."
            )
            logger.warning(warning_msg)
            scaled_sample = scaler.transform([[1, req.c_rate, req.temperature]])[0]
            logger.info(
                "Scaled inputs (unclamped): cycle_scaled=%.4f, c_rate_scaled=%.4f, temp_scaled=%.4f",
                scaled_sample[0], scaled_sample[1], scaled_sample[2]
            )

    cycles = np.arange(1, req.n_cycles + 1, dtype=np.float32)
    X_raw = np.stack(
        [
            cycles,
            np.full(req.n_cycles, req.c_rate, dtype=np.float32),
            np.full(req.n_cycles, req.temperature, dtype=np.float32),
        ],
        axis=1,
    )
    X = scaler.transform(X_raw).astype(np.float32) if scaler is not None else X_raw

    preds = {}
    for key in ("baseline_a", "pinn"):
        entry = STATE["models"].get(key)
        preds[key] = (
            entry[0].predict(entry[1], X) if entry is not None
            else np.zeros(req.n_cycles, dtype=np.float32)
        )

    # Determine ground truth curve and type
    df = STATE["raw"]
    is_known = False
    real = None
    ground_truth_type = "simulated"

    if df is not None and req.profile_id:
        subset = df[df["profile_id"] == req.profile_id].sort_values("cycle")
        if not subset.empty:
            is_known = True
            values = subset[TARGET_COL].to_numpy(dtype=np.float64)
            if values.size >= req.n_cycles:
                real = values[:req.n_cycles]
            else:
                padded = np.full(req.n_cycles, values[-1], dtype=np.float64)
                padded[: values.size] = values
                real = padded
            ground_truth_type = "measured"

    if not is_known:
        real = simulate_degradation_ode(req.c_rate, req.temperature, req.n_cycles)
        ground_truth_type = "simulated"

    results = evaluate_all(real, preds)

    return {
        "cycles": [int(c) for c in cycles],
        "real": np.round(real, 6).tolist(),
        "baseline_a": np.round(preds["baseline_a"].astype(np.float64), 6).tolist(),
        "pinn": np.round(preds["pinn"].astype(np.float64), 6).tolist(),
        "metrics": {
            key: {"mae": round(val["mae"], 6), "rmse": round(val["rmse"], 6)}
            for key, val in results["metrics"].items()
        },
        "violations": results["violations"],
        "ground_truth_type": ground_truth_type,
        "warning": warning_msg,
    }

