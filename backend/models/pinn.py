"""PINN: composite data + physics loss enforcing monotonically non-increasing SOH."""

from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

SAVED_DIR = Path(__file__).resolve().parent / "saved"
SAVE_PATH = SAVED_DIR / "pinn.pt"

EPOCHS = 400
BATCH_SIZE = 64
LEARNING_RATE = 1e-3
LAMBDA = 0.5
EPSILON = 0.01
IN_FEATURES = 3


class PINN(nn.Module):
    def __init__(self, in_features: int = IN_FEATURES):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, 64),
            nn.Tanh(),
            nn.Linear(64, 64),
            nn.Tanh(),
            nn.Linear(64, 32),
            nn.Tanh(),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def physics_loss(model: PINN, X: torch.Tensor, cycle_col_idx: int = 0) -> torch.Tensor:
    """mean(ReLU(SOH(cycle + eps) - SOH(cycle))): penalise any increase in SOH."""
    X_perturbed = X.clone()
    X_perturbed[:, cycle_col_idx] = X_perturbed[:, cycle_col_idx] + EPSILON
    delta = model(X_perturbed) - model(X)
    return torch.mean(torch.relu(delta))


def train(X_train: np.ndarray, y_train: np.ndarray, cycle_col_idx: int = 0) -> PINN:
    torch.manual_seed(42)
    X = torch.as_tensor(np.asarray(X_train, dtype=np.float32))
    y = torch.as_tensor(np.asarray(y_train, dtype=np.float32)).reshape(-1, 1)

    model = PINN(in_features=X.shape[1])
    criterion = nn.MSELoss()
    optimiser = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loader = DataLoader(TensorDataset(X, y), batch_size=BATCH_SIZE, shuffle=True)

    model.train()
    for epoch in range(1, EPOCHS + 1):
        data_sum = 0.0
        physics_sum = 0.0
        for xb, yb in loader:
            optimiser.zero_grad()
            l_data = criterion(model(xb), yb)
            l_physics = physics_loss(model, xb, cycle_col_idx=cycle_col_idx)
            loss = l_data + LAMBDA * l_physics
            loss.backward()
            optimiser.step()
            data_sum += l_data.item() * xb.shape[0]
            physics_sum += l_physics.item() * xb.shape[0]
        if epoch % 50 == 0 or epoch == 1:
            n = len(X)
            print(
                f"[pinn] epoch {epoch:4d}/{EPOCHS}  "
                f"l_data={data_sum / n:.6f}  l_physics={physics_sum / n:.8f}"
            )

    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), SAVE_PATH)
    print(f"[pinn] saved -> {SAVE_PATH}")
    return model


def load(in_features: int = IN_FEATURES) -> PINN:
    model = PINN(in_features=in_features)
    model.load_state_dict(torch.load(SAVE_PATH, map_location="cpu"))
    model.eval()
    return model


def predict(model: PINN, X: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        out = model(torch.as_tensor(np.asarray(X, dtype=np.float32)))
    return out.numpy().ravel()
