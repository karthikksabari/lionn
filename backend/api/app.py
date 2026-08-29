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
    profile_id: str
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


def real_curve(profile_id: str, n_cycles: int) -> np.ndarray:
    df = STATE["raw"]
    if df is not None:
        subset = df[df["profile_id"] == profile_id].sort_values("cycle")
        if not subset.empty:
            values = subset[TARGET_COL].to_numpy(dtype=np.float64)
            if values.size >= n_cycles:
                return values[:n_cycles]
            padded = np.full(n_cycles, values[-1], dtype=np.float64)
            padded[: values.size] = values
            return padded
    return synthetic_curve(n_cycles).astype(np.float64)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> dict:
    cycles = np.arange(1, req.n_cycles + 1, dtype=np.float32)
    X_raw = np.stack(
        [
            cycles,
            np.full(req.n_cycles, req.c_rate, dtype=np.float32),
            np.full(req.n_cycles, req.temperature, dtype=np.float32),
        ],
        axis=1,
    )

    scaler = STATE["scaler"]
    X = scaler.transform(X_raw).astype(np.float32) if scaler is not None else X_raw

    preds = {}
    for key in ("baseline_a", "pinn"):
        entry = STATE["models"].get(key)
        preds[key] = (
            entry[0].predict(entry[1], X) if entry is not None
            else np.zeros(req.n_cycles, dtype=np.float32)
        )

    real = real_curve(req.profile_id, req.n_cycles)
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
    }
