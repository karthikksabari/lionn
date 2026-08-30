import json
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from backend.api.app import app, STATE


class IdentityScaler:
    def transform(self, X):
        # return as float32 like real scaler
        return np.asarray(X, dtype=np.float32)


class DummyModule:
    @staticmethod
    def load():
        return None

    @staticmethod
    def predict(model, X):
        # Return a deterministic prediction that decreases with cycle index
        n = int(np.asarray(X).shape[0])
        return np.linspace(0.95, 0.75, n, dtype=np.float32)


client = TestClient(app)


def test_health_endpoint():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body and body["status"] == "ok"
    assert "models_loaded" in body


def test_predict_endpoint_with_dummy_models():
    # prepare STATE with dummy scaler, dummy models and a small raw dataframe
    STATE["scaler"] = IdentityScaler()
    STATE["models"]["baseline_a"] = (DummyModule, DummyModule.load())
    STATE["models"]["pinn"] = (DummyModule, DummyModule.load())

    # small raw dataset for profile REAL_001
    df = pd.DataFrame({
        "profile_id": ["REAL_001"] * 5,
        "cycle": np.arange(1, 6),
        "c_rate": [1.0] * 5,
        "temperature": [25.0] * 5,
        "soh": np.linspace(0.98, 0.9, 5),
    })
    STATE["raw"] = df

    payload = {"profile_id": "REAL_001", "c_rate": 1.0, "temperature": 25.0, "n_cycles": 5}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["cycles"] == [1, 2, 3, 4, 5]
    assert len(body["baseline_a"]) == 5
    assert len(body["pinn"]) == 5
    assert "metrics" in body and "violations" in body
    assert set(body["metrics"].keys()) == {"baseline_a", "pinn"}
    assert isinstance(body["violations"]["baseline_a"], int)
