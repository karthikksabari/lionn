"""Baseline B: deeper MLP with dropout, trained on data only (no physics constraint)."""

from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

SAVED_DIR = Path(__file__).resolve().parent / "saved"
SAVE_PATH = SAVED_DIR / "baseline_b.pt"

EPOCHS = 300
BATCH_SIZE = 64
LEARNING_RATE = 1e-3
DROPOUT = 0.2
IN_FEATURES = 3


class BaselineB(nn.Module):
    def __init__(self, in_features: int = IN_FEATURES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.ReLU(),
            nn.Dropout(DROPOUT),
            nn.Linear(64, 64),
            nn.ReLU(),
            nn.Dropout(DROPOUT),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def train(X_train: np.ndarray, y_train: np.ndarray) -> BaselineB:
    torch.manual_seed(42)
    X = torch.as_tensor(np.asarray(X_train, dtype=np.float32))
    y = torch.as_tensor(np.asarray(y_train, dtype=np.float32)).reshape(-1, 1)

    model = BaselineB(in_features=X.shape[1])
    criterion = nn.MSELoss()
    optimiser = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loader = DataLoader(TensorDataset(X, y), batch_size=BATCH_SIZE, shuffle=True)

    model.train()
    for epoch in range(1, EPOCHS + 1):
        epoch_loss = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            optimiser.step()
            epoch_loss += loss.item() * xb.shape[0]
        if epoch % 50 == 0 or epoch == 1:
            print(f"[baseline_b] epoch {epoch:4d}/{EPOCHS}  loss={epoch_loss / len(X):.6f}")

    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVE_PATH)
    print(f"[baseline_b] saved -> {SAVE_PATH}")
    return model


def load(in_features: int = IN_FEATURES) -> BaselineB:
    model = BaselineB(in_features=in_features)
    model.load_state_dict(torch.load(SAVE_PATH, map_location="cpu"))
    model.eval()
    return model


def predict(model: BaselineB, X: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        out = model(torch.as_tensor(np.asarray(X, dtype=np.float32)))
    return out.numpy().ravel()
