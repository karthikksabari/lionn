"""Train PhysicsLSTM model on sliding window sequences.

Run with: python -m scripts.train_physics_lstm
"""

import json
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from backend.data.loader import load_processed
from backend.models.physics_lstm import SAVE_PATH, SAVED_DIR, PhysicsLSTM, physics_informed_loss
from backend.utils.metrics import mae, rmse

EPOCHS = 100
BATCH_SIZE = 64
LEARNING_RATE = 1e-3


def create_sequences(X, y, window_size=10):
    Xs, ys = [], []
    for i in range(len(X) - window_size):
        Xs.append(X[i:i+window_size])
        ys.append(y[i+window_size])
    return np.array(Xs), np.array(ys)


def main() -> None:
    print("[1/4] Loading processed data...")
    X_train, X_test, y_train, y_test = load_processed()
    print(f"      X_train={X_train.shape}  X_test={X_test.shape}")

    print("[2/4] Creating sequences (window_size=10)...")
    X_train_seq, y_train_seq = create_sequences(X_train, y_train, window_size=10)
    X_test_seq, y_test_seq = create_sequences(X_test, y_test, window_size=10)
    print(f"      X_train_seq={X_train_seq.shape}  y_train_seq={y_train_seq.shape}")

    torch.manual_seed(42)
    X_tr = torch.tensor(X_train_seq, dtype=torch.float32)
    y_tr = torch.tensor(y_train_seq, dtype=torch.float32)

    dataset = TensorDataset(X_tr, y_tr)
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = PhysicsLSTM()
    optimiser = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)

    print("[3/4] Training PhysicsLSTM...")
    history = []
    model.train()
    for epoch in range(1, EPOCHS + 1):
        epoch_loss = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            pred = model(xb)
            loss = physics_informed_loss(pred, yb, lambda_weight=0.1)
            loss.backward()
            optimiser.step()
            epoch_loss += loss.item() * xb.shape[0]

        avg_loss = float(epoch_loss / len(X_tr))
        history.append(avg_loss)
        if epoch % 20 == 0 or epoch == 1:
            print(f"      epoch {epoch:3d}/{EPOCHS}  loss={avg_loss:.6f}")

    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVE_PATH)
    print(f"      Saved model weights to {SAVE_PATH}")

    # Save training history
    history_path = Path(__file__).resolve().parents[1] / "backend" / "data" / "processed" / "physics_lstm_history.json"
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with open(history_path, "w") as f:
        json.dump(history, f, indent=2)
    print(f"      Saved training history to {history_path}")

    print("[4/4] Evaluating on test set sequences...")
    model.eval()
    with torch.no_grad():
        X_te = torch.tensor(X_test_seq, dtype=torch.float32)
        preds = model(X_te).numpy().ravel()

    test_mae = mae(y_test_seq.ravel(), preds)
    test_rmse = rmse(y_test_seq.ravel(), preds)
    print(f"      Final Test MAE : {test_mae:.5f}")
    print(f"      Final Test RMSE: {test_rmse:.5f}")


if __name__ == "__main__":
    main()
