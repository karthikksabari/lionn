import numpy as np
import torch
from fastapi import APIRouter, HTTPException

from backend.data.loader import FEATURE_COLS, load_processed
from backend.models import baseline_a, physics_lstm, pinn
from backend.utils.metrics import mae, physics_metrics, rmse

compare_router = APIRouter()


def create_sequences(X, y, window_size=10):
    Xs, ys = [], []
    for i in range(len(X) - window_size):
        Xs.append(X[i:i+window_size])
        ys.append(y[i+window_size])
    return np.array(Xs), np.array(ys)


@compare_router.get("/compare")
def compare_models():
    try:
        _, X_test, _, y_test = load_processed()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load processed data: {exc}")

    try:
        model_baseline = baseline_a.load()
        model_pinn = pinn.load()
        model_lstm = physics_lstm.load()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load models: {exc}. Please make sure they are trained."
        )

    # 1. Evaluate baseline_a and pinn
    y_test_flat = y_test.ravel()
    preds_baseline = baseline_a.predict(model_baseline, X_test)
    preds_pinn = pinn.predict(model_pinn, X_test)

    mae_baseline = mae(y_test_flat, preds_baseline)
    rmse_baseline = rmse(y_test_flat, preds_baseline)

    mae_pinn = mae(y_test_flat, preds_pinn)
    rmse_pinn = rmse(y_test_flat, preds_pinn)

    # 2. Physics violations for baseline_a and pinn
    cycle_col_idx = FEATURE_COLS.index("cycle")
    condition = X_test[:, [i for i in range(X_test.shape[1]) if i != cycle_col_idx]]
    _, group_ids = np.unique(condition, axis=0, return_inverse=True)

    violations_baseline = {"count": 0, "magnitude": 0.0}
    violations_pinn = {"count": 0, "magnitude": 0.0}

    # Sort test set chronologically per group to compute physics violations
    order = np.lexsort((X_test[:, cycle_col_idx], group_ids))
    X_test_sorted = X_test[order]
    y_test_sorted = y_test[order]
    group_sorted = group_ids[order]

    # Predict on sorted test set for violations calculation
    preds_baseline_sorted = baseline_a.predict(model_baseline, X_test_sorted)
    preds_pinn_sorted = pinn.predict(model_pinn, X_test_sorted)

    for g in np.unique(group_ids):
        mask = (group_sorted == g)

        v_count_b, v_mag_b, _ = physics_metrics(preds_baseline_sorted[mask])
        violations_baseline["count"] += v_count_b
        violations_baseline["magnitude"] += v_mag_b

        v_count_p, v_mag_p, _ = physics_metrics(preds_pinn_sorted[mask])
        violations_pinn["count"] += v_count_p
        violations_pinn["magnitude"] += v_mag_p

    # 3. Evaluate physics_lstm (which requires sequences)
    preds_lstm_list = []
    y_test_lstm_list = []
    v_count_lstm = 0
    v_mag_lstm = 0.0

    for g in np.unique(group_ids):
        mask = (group_sorted == g)
        X_g = X_test_sorted[mask]
        y_g = y_test_sorted[mask]

        if len(X_g) > 10:
            X_g_seq, y_g_seq = create_sequences(X_g, y_g, window_size=10)

            # Predict using model
            X_g_seq_tensor = torch.tensor(X_g_seq, dtype=torch.float32)
            with torch.no_grad():
                pred_g = model_lstm(X_g_seq_tensor).numpy().ravel()

            preds_lstm_list.append(pred_g)
            y_test_lstm_list.append(y_g_seq.ravel())

            # Compute violations for this group
            v_c, v_m, _ = physics_metrics(pred_g)
            v_count_lstm += v_c
            v_mag_lstm += v_m

    if preds_lstm_list:
        all_preds_lstm = np.concatenate(preds_lstm_list)
        all_y_lstm = np.concatenate(y_test_lstm_list)
        mae_lstm = mae(all_y_lstm, all_preds_lstm)
        rmse_lstm = rmse(all_y_lstm, all_preds_lstm)
    else:
        mae_lstm = 0.0
        rmse_lstm = 0.0

    return {
        "baseline": {
            "mae": mae_baseline,
            "rmse": rmse_baseline,
            "physics_violation_count": violations_baseline["count"],
            "physics_violation_magnitude": violations_baseline["magnitude"],
        },
        "pinn": {
            "mae": mae_pinn,
            "rmse": rmse_pinn,
            "physics_violation_count": violations_pinn["count"],
            "physics_violation_magnitude": violations_pinn["magnitude"],
        },
        "physics_lstm": {
            "mae": mae_lstm,
            "rmse": rmse_lstm,
            "physics_violation_count": v_count_lstm,
            "physics_violation_magnitude": v_mag_lstm,
        },
    }


# Register in app.py with: app.include_router(compare_router)
