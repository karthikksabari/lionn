import numpy as np
import torch

from backend.models.physics_lstm import PhysicsLSTM, physics_informed_loss


def test_physics_lstm_forward():
    model = PhysicsLSTM()
    x = torch.randn(4, 10, 3)
    out = model(x)
    assert out.shape == (4, 1)


def test_physics_informed_loss():
    pred = torch.tensor([[0.8], [0.75], [0.72], [0.78]], dtype=torch.float32)
    actual = torch.tensor([[0.8], [0.76], [0.72], [0.68]], dtype=torch.float32)
    loss = physics_informed_loss(pred, actual, lambda_weight=0.1)
    assert isinstance(loss, torch.Tensor)
    assert loss.dim() == 0  # scalar
    assert loss.item() >= 0.0


def test_monotonic_output():
    # Load trained model if available, otherwise use a fresh model.
    try:
        from backend.models.physics_lstm import load
        model = load()
    except Exception:
        model = PhysicsLSTM()

    # Construct 50 consecutive windows where the cycle number increases.
    # Increased cycle should lead to decreasing SOH prediction.
    inputs = []
    for i in range(50):
        window = []
        for j in range(10):
            # cycle = i + j (increasing)
            # C-rate = 1.0, Temperature = 25.0
            window.append([float(i + j), 1.0, 25.0])
        inputs.append(window)

    inputs_tensor = torch.tensor(inputs, dtype=torch.float32)

    model.eval()
    with torch.no_grad():
        outputs = model(inputs_tensor).numpy().ravel()

    # If the model is trained, it should predict strictly or mostly decreasing SOH.
    # Let's count how many times prediction decreases from step to step.
    diffs = np.diff(outputs)
    decreases = np.sum(diffs < 0)

    assert len(outputs) == 50

    # If trained (weights file exists), assert that the majority of transitions are decreasing.
    from backend.models.physics_lstm import SAVE_PATH
    if SAVE_PATH.exists():
        assert decreases > 25, f"Physics constraint failed: only {decreases}/49 decreases in prediction"
