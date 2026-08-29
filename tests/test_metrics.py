import numpy as np
from backend.utils.metrics import mae, rmse, count_physics_violations, evaluate_all


def test_metrics_basic():
    y_true = np.array([1.0, 0.9, 0.8])
    y_pred = np.array([0.9, 0.85, 0.75])
    assert round(mae(y_true, y_pred), 6) == round(np.mean(np.abs(y_true - y_pred)), 6)
    assert round(rmse(y_true, y_pred), 6) == round(np.sqrt(np.mean((y_true - y_pred) ** 2)), 6)
    assert count_physics_violations(y_pred) == 0

    preds = {"baseline_a": y_pred, "pinn": y_pred}
    res = evaluate_all(y_true, preds)
    assert "metrics" in res and "violations" in res
