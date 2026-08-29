"""Accuracy metrics and physics-violation counting."""

import numpy as np

MODEL_KEYS = ("baseline_a", "baseline_b", "pinn")


def mae(y_true, y_pred) -> float:
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true, y_pred) -> float:
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
    """
    groups = None if groups is None else np.asarray(groups)
    metrics = {}
    violations = {}
    for key in MODEL_KEYS:
        y_pred = np.asarray(preds[key], dtype=np.float64).ravel()
        metrics[key] = {"mae": mae(y_true, y_pred), "rmse": rmse(y_true, y_pred)}
        if groups is None:
            violations[key] = count_physics_violations(y_pred)
        else:
            violations[key] = sum(
                count_physics_violations(y_pred[groups == g]) for g in np.unique(groups)
            )
    return {"metrics": metrics, "violations": violations}
