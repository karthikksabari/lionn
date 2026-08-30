"""LSTM Model: PyTorch LSTM trained on data for battery SOH prediction."""

from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

SAVED_DIR = Path(__file__).resolve().parent / "saved"
SAVE_PATH = SAVED_DIR / "lstm_model.pt"

EPOCHS = 300
BATCH_SIZE = 64
LEARNING_RATE = 1e-3
IN_FEATURES = 3


class LSTMModel(nn.Module):
    def __init__(self, input_size: int = IN_FEATURES, hidden_size: int = 32, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0
        )
        self.linear = nn.Linear(hidden_size, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Input shape: (batch_size, input_size)
        # Unsqueeze to add a sequence dimension: (batch_size, 1, input_size)
        x_seq = x.unsqueeze(1)
        out, _ = self.lstm(x_seq)
        # out shape: (batch_size, 1, hidden_size)
        out = out.squeeze(1)  # shape: (batch_size, hidden_size)
        return self.linear(out)


def train_with_history(X_train: np.ndarray, y_train: np.ndarray) -> tuple[LSTMModel, list[float]]:
    torch.manual_seed(42)
    X = torch.as_tensor(np.asarray(X_train, dtype=np.float32))
    y = torch.as_tensor(np.asarray(y_train, dtype=np.float32)).reshape(-1, 1)

    model = LSTMModel(input_size=X.shape[1])
    criterion = nn.MSELoss()
    optimiser = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loader = DataLoader(TensorDataset(X, y), batch_size=BATCH_SIZE, shuffle=True)

    losses = []
    model.train()
    for epoch in range(1, EPOCHS + 1):
        epoch_loss = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimiser.step()
            epoch_loss += loss.item() * xb.shape[0]
        loss_val = float(epoch_loss / len(X))
        losses.append(loss_val)
        if epoch % 50 == 0 or epoch == 1:
            print(f"[lstm_model] epoch {epoch:4d}/{EPOCHS}  loss={loss_val:.6f}")

    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVE_PATH)
    print(f"[lstm_model] saved -> {SAVE_PATH}")
    return model, losses


def train(X_train: np.ndarray, y_train: np.ndarray) -> LSTMModel:
    model, _ = train_with_history(X_train, y_train)
    return model


def load(input_size: int = IN_FEATURES) -> LSTMModel:
    model = LSTMModel(input_size=input_size)
    model.load_state_dict(torch.load(SAVE_PATH, map_location="cpu"))
    model.eval()
    return model


def predict(model: LSTMModel, X: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        out = model(torch.as_tensor(np.asarray(X, dtype=np.float32)))
    return out.numpy().ravel()
