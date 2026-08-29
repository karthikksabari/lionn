# LIONN
Physics-Informed Neural Network for Li-Ion Battery SOH/RUL prognostics under distribution shift.
Team: Web-Acharis

- /backend  — data pipeline, models, PINN, evaluation, serving
- /frontend — React dashboard
- CONTRACT.md — shared API schema between backend and frontend

## Backend / ML

Trains three models (Baseline A, Baseline B, PINN) on battery degradation data and serves
predicted SOH curves, accuracy metrics and physics-violation counts from a FastAPI endpoint.

### Layout

```
backend/
  api/app.py            FastAPI app (/health, /predict)
  data/loader.py        raw loading (NASA .mat or synthetic fallback) + preprocessing
  data/raw/             drop NASA .mat files here
  data/processed/       scaler.pkl, X_train.npy, X_test.npy, y_train.npy, y_test.npy
  models/baseline_a.py  shallow MLP, data loss only
  models/baseline_b.py  deeper MLP + dropout, data loss only
  models/pinn.py        Tanh/Sigmoid MLP, L_data + λ·L_physics
  models/saved/         *.pt state dicts
  utils/metrics.py      mae, rmse, count_physics_violations, evaluate_all
scripts/train.py        full pipeline, prints the comparison table
```

### Usage

```bash
pip install -r requirements.txt
python -m scripts.train
uvicorn backend.api.app:app --reload   # http://localhost:8000/docs
```

Smoke test:

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"profile_id":"NASA_B0005","c_rate":1.0,"temperature":25.0,"n_cycles":100}'
```

### Data

Real data: NASA Battery Dataset (B0005, B0006, B0007, B0018) —
https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository

Place the `.mat` files in `backend/data/raw/`. When that directory is empty the loader
generates synthetic curves `soh(cycle) = exp(-decay_rate * cycle) + noise`
(`decay_rate ~ U(0.003, 0.006)`, `noise ~ N(0, 0.005)`).

Parsing real `.mat` files requires `scipy`, which is not in `requirements.txt`; it is imported
lazily inside `load_nasa_mat`, so the synthetic path runs with the pinned dependencies only.

### Physics constraint

SOH must be non-increasing in cycle count: `dSOH/d(cycle) <= 0`.

```
L_total   = L_data + λ * L_physics          (λ = 0.5)
L_data    = MSE(pred, y_true)
L_physics = mean(ReLU(SOH(cycle + ε) − SOH(cycle)))    (ε = 0.01, normalised cycle space)
```

`physics_loss` is evaluated inside the PINN training loop on every batch.
