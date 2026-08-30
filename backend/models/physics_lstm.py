"""Physics-Informed LSTM Model for battery SOH prediction."""

from pathlib import Path

import numpy as np
import torch
from torch import nn

SAVED_DIR = Path(__file__).resolve().parent / "saved"
SAVE_PATH = SAVED_DIR / "physics_lstm.pt"

IN_FEATURES = 3


class PhysicsLSTM(nn.Module):
    def __init__(self, input_size: int = IN_FEATURES, hidden_size: int = 32, num_layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True
        )
        self.linear = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # If input is 2D (batch_size, input_size), unsqueeze to add sequence dimension
        if x.dim() == 2:
            x = x.unsqueeze(1)
        out, _ = self.lstm(x)
        # Pass the last hidden state to the linear layer
        last_hidden = out[:, -1, :]
        return self.linear(last_hidden)


def physics_informed_loss(
    pred_sequence: torch.Tensor,
    actual: torch.Tensor,
    lambda_weight: float = 0.1
) -> torch.Tensor:
    """Compute standard MSE loss combined with a monotonic degradation penalty."""
    mse = torch.mean((pred_sequence - actual) ** 2)
    if pred_sequence.size(0) < 2:
        return mse
    # Physics penalty: penalise any increase in consecutive SOH predictions
    diffs = pred_sequence[1:] - pred_sequence[:-1]
    physics_penalty = torch.mean(torch.relu(diffs))
    return mse + lambda_weight * physics_penalty


def load(*args, **kwargs) -> PhysicsLSTM:
    """Load the model and weights."""
    model = PhysicsLSTM()
    model.load_state_dict(torch.load(SAVE_PATH, map_location="cpu"))
    model.eval()
    return model


def predict(model: PhysicsLSTM, X: np.ndarray) -> np.ndarray:
    """Run model inference on inputs.

    Note: If inputs are not pre-sequenced, we repeat each point 10 times to form a valid sequence.
    """
    model.eval()
    if X.ndim == 2:
        # Unsqueeze and repeat 10 times to match seq_len = 10
        X_seq = np.repeat(X[:, np.newaxis, :], 10, axis=1)
    else:
        X_seq = X

    with torch.no_grad():
        out = model(torch.as_tensor(np.asarray(X_seq, dtype=np.float32)))
    return out.numpy().ravel()


def train(X_train: np.ndarray, y_train: np.ndarray, cycle_col_idx: int = 0) -> PhysicsLSTM:
    """Train PhysicsLSTM model on sliding window sequences."""
    from torch.utils.data import DataLoader, TensorDataset

    def create_sequences(X, y, window_size=10):
        Xs, ys = [], []
        for i in range(len(X) - window_size):
            Xs.append(X[i:i+window_size])
            ys.append(y[i+window_size])
        return np.array(Xs), np.array(ys)

    X_train_seq, y_train_seq = create_sequences(X_train, y_train, window_size=10)

    torch.manual_seed(42)
    X_tr = torch.tensor(X_train_seq, dtype=torch.float32)
    y_tr = torch.tensor(y_train_seq, dtype=torch.float32)

    dataset = TensorDataset(X_tr, y_tr)
    loader = DataLoader(dataset, batch_size=64, shuffle=False)

    model = PhysicsLSTM(input_size=X_tr.shape[2])
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)

    model.train()
    for epoch in range(1, 101):
        epoch_loss = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            pred = model(xb)
            loss = physics_informed_loss(pred, yb, lambda_weight=0.1)
            loss.backward()
            optimiser.step()
            epoch_loss += loss.item() * xb.shape[0]

    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVE_PATH)
    print(f"[physics_lstm] saved -> {SAVE_PATH}")
    return model

