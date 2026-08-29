"""FastAPI service exposing SOH predictions from all three models."""

import logging
from functools import lru_cache

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.data.loader import (
    FEATURE_COLS,
    TARGET_COL,
    load_scaler,
    synthetic_curve,
    get_profile_lookup,
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

STATE: dict = {"scaler": None, "models": {}, "profile_lookup": {}}


class PredictRequest(BaseModel):
    profile_id: str
    c_rate: float = Field(..., ge=0.1, le=5.0)
    temperature: float = Field(..., ge=-20.0, le=60.0)
    n_cycles: int = Field(100, ge=10, le=500)


class BatchPredictRequest(BaseModel):
    requests: list[PredictRequest]


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
        STATE["profile_lookup"] = get_profile_lookup()
    except Exception as exc:  # noqa: BLE001
        logger.warning("profile lookup unavailable (%s)", exc)


def models_loaded() -> bool:
    return STATE["scaler"] is not None and len(STATE["models"]) == 2


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "models_loaded": models_loaded()}


def real_curve(profile_id: str, n_cycles: int) -> np.ndarray:
    """Fetch real curve using O(1) lookup instead of dataframe filtering."""
    lookup = STATE["profile_lookup"]
    if profile_id in lookup:
        values = lookup[profile_id]
        if values.size >= n_cycles:
            return values[:n_cycles].copy()
        padded = np.full(n_cycles, values[-1], dtype=np.float64)
        padded[: values.size] = values
        return padded
    return synthetic_curve(n_cycles).astype(np.float64)


@lru_cache(maxsize=128)
def _get_scaled_template(n_cycles: int, c_rate: float, temperature: float) -> np.ndarray:
    """Cache scaled feature arrays for common combinations."""
    cycles = np.arange(1, n_cycles + 1, dtype=np.float32)
    X_raw = np.stack(
        [
            cycles,
            np.full(n_cycles, c_rate, dtype=np.float32),
            np.full(n_cycles, temperature, dtype=np.float32),
        ],
        axis=1,
    )
    scaler = STATE["scaler"]
    return scaler.transform(X_raw).astype(np.float32) if scaler is not None else X_raw


def get_scaled_features(n_cycles: int, c_rate: float, temperature: float) -> np.ndarray:
    """Get scaled feature array, using cache when available."""
    try:
        return _get_scaled_template(n_cycles, c_rate, temperature)
    except TypeError:
        # Fallback if c_rate or temperature are not hashable
        cycles = np.arange(1, n_cycles + 1, dtype=np.float32)
        X_raw = np.stack(
            [
                cycles,
                np.full(n_cycles, c_rate, dtype=np.float32),
                np.full(n_cycles, temperature, dtype=np.float32),
            ],
            axis=1,
        )
        scaler = STATE["scaler"]
        return scaler.transform(X_raw).astype(np.float32) if scaler is not None else X_raw


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> dict:
    # Get scaled features (cached when possible)
    X = get_scaled_features(req.n_cycles, req.c_rate, req.temperature)
    cycles = np.arange(1, req.n_cycles + 1, dtype=np.int32)

    # Reuse models from STATE instead of reloading (issue #3 fixed)
    preds = {}
    for key in ("baseline_a", "pinn"):
        entry = STATE["models"].get(key)
        preds[key] = (
            entry[0].predict(entry[1], X) if entry is not None
            else np.zeros(req.n_cycles, dtype=np.float32)
        )

    real = real_curve(req.profile_id, req.n_cycles)
    results = evaluate_all(real, preds)

    # Prepare response with minimal conversions
    return {
        "cycles": cycles.tolist(),
        "real": real.round(6).tolist(),
        "baseline_a": preds["baseline_a"].astype(np.float64).round(6).tolist(),
        "pinn": preds["pinn"].astype(np.float64).round(6).tolist(),
        "metrics": {
            key: {"mae": round(val["mae"], 6), "rmse": round(val["rmse"], 6)}
            for key, val in results["metrics"].items()
        },
        "violations": results["violations"],
    }


@app.post("/predict/batch")
def predict_batch(req: BatchPredictRequest) -> list[PredictResponse]:
    """Process multiple predictions in a batch for better throughput."""
    return [predict(pred_req) for pred_req in req.requests]
