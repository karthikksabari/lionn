from fastapi.testclient import TestClient
import numpy as np

from backend.api.app import app, STATE
from backend.data.loader import generate_synthetic_dataset


client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert "status" in resp.json()


def test_predict_smoke():
    # ensure profiles are present
    STATE["raw"] = generate_synthetic_dataset(n_profiles=2, n_cycles=50)
    STATE["profiles"] = {k: v for k, v in (lambda df: {pid: g.sort_values("cycle")["soh"].to_numpy(dtype=np.float32) for pid, g in df.groupby("profile_id")})(STATE["raw"])}

    payload = {"profile_id": "SYNTH_000", "c_rate": 1.0, "temperature": 25.0, "n_cycles": 20}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["cycles"]) == 20
    assert len(data["real"]) == 20
    assert "baseline_a" in data and "pinn" in data
