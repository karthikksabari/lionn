import numpy as np
from backend.utils import metrics


def test_mae_rmse():
    y_true = np.array([1.0, 2.0, 3.0])
    y_pred = np.array([1.0, 2.0, 4.0])

    m = metrics.mae(y_true, y_pred)
    r = metrics.rmse(y_true, y_pred)

    assert abs(m - (1.0 / 3.0)) < 1e-9
    assert abs(r - ( (1.0 / 3.0) ** 0.5 )) < 1e-9


def test_count_physics_violations():
    preds = [0.9, 0.91, 0.89, 0.88]
    assert metrics.count_physics_violations(preds) == 1
    assert metrics.count_physics_violations([0.5]) == 0


def test_evaluate_all_groups():
    # two profiles concatenated: profile A (2 cycles), profile B (3 cycles)
    y_true = np.array([0.9, 0.88, 0.95, 0.93, 0.92])
    # baseline has one violation in profile A, none in B
    baseline_pred = np.array([0.91, 0.89, 0.95, 0.94, 0.92])
    pinn_pred = np.array([0.9, 0.88, 0.95, 0.93, 0.92])
    preds = {"baseline_a": baseline_pred, "pinn": pinn_pred}
    groups = np.array(["A", "A", "B", "B", "B"]) 

    res = metrics.evaluate_all(y_true, preds, groups=groups)
    assert "metrics" in res and "violations" in res
    assert res["violations"]["baseline_a"] >= 0
    assert res["violations"]["pinn"] == 0
