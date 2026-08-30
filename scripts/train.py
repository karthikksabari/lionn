"""Train Baseline A and the PINN, then print a comparison table.

Run with: python -m scripts.train
"""

import numpy as np

from backend.data.loader import FEATURE_COLS, load_all_raw, preprocess
from backend.models import baseline_a, physics_lstm as pinn
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
    import json
    from pathlib import Path
    from backend.models import baseline_a, physics_lstm as pinn

    baseline_a_losses = []
    pinn_losses = []

    # Save original training functions
    _orig_baseline_train = baseline_a.train
    _orig_pinn_train = pinn.train

    def wrapped_baseline_train(X_train, y_train):
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, TensorDataset

        torch.manual_seed(42)
        X = torch.as_tensor(np.asarray(X_train, dtype=np.float32))
        y = torch.as_tensor(np.asarray(y_train, dtype=np.float32)).reshape(-1, 1)

        model = baseline_a.BaselineA(in_features=X.shape[1])
        criterion = nn.MSELoss()
        optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
        loader = DataLoader(TensorDataset(X, y), batch_size=64, shuffle=True)

        model.train()
        for epoch in range(1, 301):
            epoch_loss = 0.0
            for xb, yb in loader:
                optimiser.zero_grad()
                loss = criterion(model(xb), yb)
                loss.backward()
                optimiser.step()
                epoch_loss += loss.item() * xb.shape[0]
            loss_val = float(epoch_loss / len(X))
            baseline_a_losses.append(loss_val)
            if epoch % 50 == 0 or epoch == 1:
                print(f"[baseline_a] epoch {epoch:4d}/300  loss={loss_val:.6f}")

        baseline_a.SAVED_DIR.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), baseline_a.SAVE_PATH)
        print(f"[baseline_a] saved -> {baseline_a.SAVE_PATH}")
        return model

    def wrapped_pinn_train(X_train, y_train, cycle_col_idx=0):
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, TensorDataset

        def create_sequences(X, y, window_size=10):
            Xs, ys = [], []
            for i in range(len(X) - window_size):
                Xs.append(X[i:i+window_size])
                ys.append(y[i+window_size])
            return np.array(Xs), np.array(ys)

        X_train_seq, y_train_seq = create_sequences(X_train, y_train, window_size=10)

        torch.manual_seed(42)
        X = torch.as_tensor(np.asarray(X_train_seq, dtype=np.float32))
        y = torch.as_tensor(np.asarray(y_train_seq, dtype=np.float32)).reshape(-1, 1)

        model = pinn.PhysicsLSTM(input_size=X.shape[2])
        criterion = nn.MSELoss()
        optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
        loader = DataLoader(TensorDataset(X, y), batch_size=64, shuffle=False)

        model.train()
        for epoch in range(1, 101):
            epoch_loss = 0.0
            for xb, yb in loader:
                optimiser.zero_grad()
                pred = model(xb)
                loss = pinn.physics_informed_loss(pred, yb, lambda_weight=0.1)
                loss.backward()
                optimiser.step()
                epoch_loss += loss.item() * xb.shape[0]
            loss_val = float(epoch_loss / len(X))
            pinn_losses.append(loss_val)
            if epoch % 20 == 0 or epoch == 1:
                print(f"[physics_lstm] epoch {epoch:4d}/100  loss={loss_val:.6f}")

        pinn.SAVED_DIR.mkdir(parents=True, exist_ok=True)
        torch.save(model.state_dict(), pinn.SAVE_PATH)
        print(f"[physics_lstm] saved -> {pinn.SAVE_PATH}")
        return model

    # Patch baseline_a and pinn modules
    baseline_a.train = wrapped_baseline_train
    pinn.train = wrapped_pinn_train

    # Run the main training of scripts/train.py
    main()

    # Save the training history
    history_data = {
        "baseline_a": baseline_a_losses,
        "pinn": pinn_losses,
    }

    history_path = Path(__file__).resolve().parents[1] / "backend" / "data" / "processed" / "training_history.json"
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with open(history_path, "w") as f:
        json.dump(history_data, f, indent=2)
    print(f"[train] training history saved -> {history_path}")
