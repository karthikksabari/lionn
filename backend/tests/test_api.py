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
        "profile_id": ["REAL_001"] * 10,
        "cycle": np.arange(1, 11),
        "c_rate": [1.0] * 10,
        "temperature": [25.0] * 10,
        "soh": np.linspace(0.98, 0.9, 10),
    })
    STATE["raw"] = df

    payload = {"profile_id": "REAL_001", "c_rate": 1.0, "temperature": 25.0, "n_cycles": 10}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["cycles"] == list(range(1, 11))
    assert len(body["baseline_a"]) == 10
    assert len(body["pinn"]) == 10
    assert "metrics" in body and "violations" in body
    assert set(body["metrics"].keys()) == {"baseline_a", "pinn"}
    assert isinstance(body["violations"]["baseline_a"], int)
    assert "warning" in body


def test_profiles_endpoint():
    # prepare STATE with a small raw dataframe
    df = pd.DataFrame({
        "profile_id": ["REAL_001", "REAL_002"],
        "cycle": [1.0, 1.0],
        "c_rate": [1.0, 2.0],
        "temperature": [25.0, 30.0],
        "soh": [0.98, 0.95],
    })
    STATE["raw"] = df

    resp = client.get("/profiles")
    assert resp.status_code == 200
    body = resp.json()
    assert "profiles" in body
    profiles = body["profiles"]
    assert len(profiles) == 2

    # check shape of each profile item
    p1 = profiles[0]
    assert p1["profile_id"] == "REAL_001"
    assert "label" in p1
    assert p1["c_rate"] == 1.0
    assert p1["temperature"] == 25.0
    assert p1["max_cycles"] == 1
    assert p1["split"] in ("train", "test")


def test_predict_endpoint_custom_scenario():
    STATE["scaler"] = IdentityScaler()
    STATE["models"]["baseline_a"] = (DummyModule, DummyModule.load())
    STATE["models"]["pinn"] = (DummyModule, DummyModule.load())

    # missing/None profile_id should trigger simulated ground truth
    payload = {"c_rate": 1.5, "temperature": 35.0, "n_cycles": 10}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ground_truth_type"] == "simulated"
    assert "warning" in body
    # SOH values should be non-increasing
    assert len(body["real"]) == 10
    assert body["real"][0] > body["real"][-1]

    # provided profile_id matching a known profile should return measured ground truth
    df = pd.DataFrame({
        "profile_id": ["REAL_001"] * 10,
        "cycle": np.arange(1, 11),
        "c_rate": [1.0] * 10,
        "temperature": [25.0] * 10,
        "soh": np.linspace(0.98, 0.9, 10),
    })
    STATE["raw"] = df
    payload_measured = {"profile_id": "REAL_001", "c_rate": 1.0, "temperature": 25.0, "n_cycles": 10}
    resp_measured = client.post("/predict", json=payload_measured)
    assert resp_measured.status_code == 200
    body_measured = resp_measured.json()
    assert body_measured["ground_truth_type"] == "measured"
    assert body_measured["real"] == [round(x, 6) for x in np.linspace(0.98, 0.9, 10)]
    assert "warning" in body_measured


def test_predict_extrapolation_warning():
    class ScalerWithBounds:
        def __init__(self):
            self.data_min_ = np.array([1.0, 0.5, 10.0])
            self.data_max_ = np.array([200.0, 2.0, 40.0])
        def transform(self, X):
            return np.asarray(X, dtype=np.float32)

    STATE["scaler"] = ScalerWithBounds()
    STATE["models"]["baseline_a"] = (DummyModule, DummyModule.load())
    STATE["models"]["pinn"] = (DummyModule, DummyModule.load())

    # c_rate=5.0 is out of bounds [0.5, 2.0]
    payload = {
        "c_rate": 5.0,
        "temperature": 25.0,
        "n_cycles": 15,
    }
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "warning" in body
    assert body["warning"] is not None
    assert "Extrapolation warning" in body["warning"]


