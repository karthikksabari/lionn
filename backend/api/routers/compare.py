import numpy as np
from fastapi import APIRouter, HTTPException

from backend.data.loader import FEATURE_COLS, load_processed
from backend.models import baseline_a, pinn
from backend.utils.metrics import mae, physics_metrics, rmse

compare_router = APIRouter()


@compare_router.get("/compare")
def compare_models():
    try:
        _, X_test, _, y_test = load_processed()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load processed data: {exc}")

    try:
        model_baseline = baseline_a.load()
        model_pinn = pinn.load()
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load models: {exc}. Please make sure they are trained."
        )

    y_test_flat = y_test.ravel()

    # Predict
    preds_baseline = baseline_a.predict(model_baseline, X_test)
    preds_pinn = pinn.predict(model_pinn, X_test)

    # MAE and RMSE on the entire test set
    mae_baseline = mae(y_test_flat, preds_baseline)
    rmse_baseline = rmse(y_test_flat, preds_baseline)

    mae_pinn = mae(y_test_flat, preds_pinn)
    rmse_pinn = rmse(y_test_flat, preds_pinn)

    # Physics violations (must be calculated within each battery profile group)
    cycle_col_idx = FEATURE_COLS.index("cycle")
    condition = X_test[:, [i for i in range(X_test.shape[1]) if i != cycle_col_idx]]
    _, group_ids = np.unique(condition, axis=0, return_inverse=True)

    # Group by group_ids, sort by cycle, and call physics_metrics
    violations_baseline = {"count": 0, "magnitude": 0.0, "max": 0.0}
    violations_pinn = {"count": 0, "magnitude": 0.0, "max": 0.0}

    for g in np.unique(group_ids):
        mask = (group_ids == g)
        cycles = X_test[mask, cycle_col_idx]
        sort_idx = np.argsort(cycles)

        group_preds_baseline = preds_baseline[mask][sort_idx]
        v_count_b, v_mag_b, v_max_b = physics_metrics(group_preds_baseline)
        violations_baseline["count"] += v_count_b
        violations_baseline["magnitude"] += v_mag_b
        violations_baseline["max"] = max(violations_baseline["max"], v_max_b)

        group_preds_pinn = preds_pinn[mask][sort_idx]
        v_count_p, v_mag_p, v_max_p = physics_metrics(group_preds_pinn)
        violations_pinn["count"] += v_count_p
        violations_pinn["magnitude"] += v_mag_p
        violations_pinn["max"] = max(violations_pinn["max"], v_max_p)

    return {
        "baseline_a": {
            "mae": mae_baseline,
            "rmse": rmse_baseline,
            "violations": violations_baseline,
        },
        "pinn": {
            "mae": mae_pinn,
            "rmse": rmse_pinn,
            "violations": violations_pinn,
        },
    }


# Register this router in app.py with: app.include_router(compare_router)
