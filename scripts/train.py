"""Train Baseline A and the PINN, then print a comparison table.

Run with: python -m scripts.train
"""

import numpy as np

from backend.data.loader import FEATURE_COLS, load_all_raw, preprocess
from backend.models import baseline_a, pinn
from backend.utils.metrics import MODEL_KEYS, evaluate_all

CYCLE_COL_IDX = FEATURE_COLS.index("cycle")


def main() -> None:
    print("[1/5] loading raw data")
    df = load_all_raw()
    print(f"      rows={len(df)}  profiles={df['profile_id'].nunique()}")

    print("[2/5] preprocessing (scaler fitted on train split only)")
    X_train, X_test, y_train, y_test, _ = preprocess(df)
    print(f"      X_train={X_train.shape}  X_test={X_test.shape}")

    print("[3/5] training baseline_a")
    baseline_a.train(X_train, y_train)

    print("[4/5] training pinn")
    pinn.train(X_train, y_train, cycle_col_idx=CYCLE_COL_IDX)

    print("[5/5] evaluating on held-out test split")
    models = {
        "baseline_a": (baseline_a, baseline_a.load(X_train.shape[1])),
        "pinn": (pinn, pinn.load(X_train.shape[1])),
    }

    # Violation counts compare consecutive cycles of one battery, so evaluate the test
    # rows grouped by operating condition and ordered by cycle within each group.
    condition = X_test[:, [i for i in range(X_test.shape[1]) if i != CYCLE_COL_IDX]]
    groups, group_ids = np.unique(condition, axis=0, return_inverse=True)
    order = np.lexsort((X_test[:, CYCLE_COL_IDX], group_ids))
    X_eval, y_eval, group_eval = X_test[order], y_test[order], group_ids[order]
    print(f"      test profiles={len(groups)}")

    preds = {key: module.predict(model, X_eval) for key, (module, model) in models.items()}
    results = evaluate_all(y_eval, preds, groups=group_eval)

    print()
    print("  Model        MAE      RMSE   Violations")
    print("  -------------------------------------------")
    for key in MODEL_KEYS:
        m = results["metrics"][key]
        print(f"  {key:<11}{m['mae']:.5f}  {m['rmse']:.5f}  {results['violations'][key]:>10d}")
    print()


if __name__ == "__main__":
    main()
