"""Uncertainty quantification using MC dropout."""

import numpy as np
import torch


def predict_with_uncertainty(model, x, n_samples: int = 50) -> dict:
    """Run the model in train mode to perform MC dropout sampling."""
    was_training = model.training
    model.train()

    if not isinstance(x, torch.Tensor):
        x_tensor = torch.as_tensor(np.asarray(x, dtype=np.float32))
    else:
        x_tensor = x

    preds = []
    with torch.no_grad():
        for _ in range(n_samples):
            out = model(x_tensor)
            preds.append(out.cpu().numpy().ravel())

    if not was_training:
        model.eval()

    preds = np.array(preds)  # shape: (n_samples, num_samples)

    mean_val = np.mean(preds, axis=0)
    lower_val = np.percentile(preds, 5, axis=0)
    upper_val = np.percentile(preds, 95, axis=0)

    return {
        "mean": mean_val,
        "lower": lower_val,
        "upper": upper_val,
    }
