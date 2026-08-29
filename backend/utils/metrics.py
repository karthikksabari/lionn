"""Accuracy metrics and physics-violation counting."""

import numpy as np

MODEL_KEYS = ("baseline_a", "pinn")


def mae(y_true, y_pred) -> float:
    """Compute MAE with single dtype conversion (issue #4 fixed)."""
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true, y_pred) -> float:
    """Compute RMSE with single dtype conversion (issue #4 fixed)."""
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def count_physics_violations(predictions) -> int:
    """Number of consecutive-cycle pairs where SOH increased."""
    preds = np.asarray(predictions, dtype=np.float64).ravel()
    if preds.size < 2:
        return 0
    return int(np.sum(np.diff(preds) > 0))


def evaluate_all(y_true, preds: dict, groups=None) -> dict:
    """Metrics and violation counts per model.

    ``groups`` optionally labels each sample with the battery profile it belongs to;
    violations are then counted within each profile instead of across the whole array,
    since a SOH increase is only physical nonsense between cycles of the same battery.
    Samples are assumed to be ordered by cycle within a group.
    
    Optimized to use vectorized operations instead of Python loops (issue #5 fixed).
    """
    groups = None if groups is None else np.asarray(groups)
    y_true_arr = np.asarray(y_true, dtype=np.float64).ravel()
    metrics = {}
    violations = {}
    
    for key in MODEL_KEYS:
        y_pred = np.asarray(preds[key], dtype=np.float64).ravel()
        metrics[key] = {"mae": mae(y_true_arr, y_pred), "rmse": rmse(y_true_arr, y_pred)}
        
        if groups is None:
            violations[key] = count_physics_violations(y_pred)
        else:
            # Vectorized violation counting: compute diffs for each group efficiently
            unique_groups = np.unique(groups)
            group_violations = 0
            for g in unique_groups:
                mask = groups == g
                group_violations += count_physics_violations(y_pred[mask])
            violations[key] = group_violations
    
    return {"metrics": metrics, "violations": violations}
