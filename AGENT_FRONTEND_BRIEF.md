# Frontend Development Brief - LIONN Battery Health Predictor

## Project Overview
Build a React dashboard for LIONN (Physics-Informed Neural Network for Li-Ion Battery SOH/RUL prognostics). The frontend must consume a FastAPI backend that predicts battery State of Health (SOH) curves using two competing models: a baseline MLP and a Physics-Informed Neural Network (PINN).

**Team**: Web-Acharis  
**Repository**: sarvajithsankar/lionn_devjams26  
**Backend Status**: ✅ Complete, containerized, and deployed to Docker Hub (`sarvajithsankar/battery-health-predictor:latest`)

---

## Backend API Contract (Ready to Use)

### Base URL
- **Development**: `http://localhost:8000`
- **Production**: `https://your-api-domain.com` (set via `VITE_API_URL` env var)

### Endpoints

#### 1. Health Check
```
GET /health
Response: {"status": "ok", "models_loaded": true}
```
Use this to verify backend connectivity on app startup.

#### 2. Predictions (Primary Endpoint)
```
POST /predict
Content-Type: application/json

Request Schema:
{
  "profile_id": string (e.g., "NASA_B0005", "SYNTH_001"),
  "c_rate": float (range: 0.1 to 5.0, C-rate in Amperes/Capacity),
  "temperature": float (range: -20.0 to 60.0, °C),
  "n_cycles": int (range: 10 to 500, number of discharge cycles)
}

Response Schema:
{
  "cycles": [int, ...],           // Cycle indices [1, 2, ..., n_cycles]
  "real": [float, ...],           // Ground truth SOH (100 points)
  "baseline_a": [float, ...],     // Baseline model predictions (100 points)
  "pinn": [float, ...],           // PINN predictions (100 points)
  "metrics": {
    "baseline_a": {
      "mae": float,               // Mean Absolute Error
      "rmse": float               // Root Mean Squared Error
    },
    "pinn": {
      "mae": float,
      "rmse": float
    }
  },
  "violations": {
    "baseline_a": int,            // Count of SOH increases (should be 0 for physics)
    "pinn": int
  }
}
```

**Example Request**:
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "profile_id": "NASA_B0005",
    "c_rate": 1.0,
    "temperature": 25.0,
    "n_cycles": 100
  }'
```

**Example Response**:
```json
{
  "cycles": [1, 2, 3, ..., 100],
  "real": [0.999, 0.998, 0.997, ..., 0.850],
  "baseline_a": [0.998, 0.997, 0.996, ..., 0.851],
  "pinn": [0.999, 0.998, 0.997, ..., 0.850],
  "metrics": {
    "baseline_a": {"mae": 0.00481, "rmse": 0.00595},
    "pinn": {"mae": 0.00471, "rmse": 0.00585}
  },
  "violations": {
    "baseline_a": 0,
    "pinn": 0
  }
}
```

---

## Backend Architecture (Context for Frontend)

The backend is production-ready and includes:

- **Data Pipeline** (`backend/data/loader.py`): Loads NASA battery dataset (.mat files) or generates synthetic SOH curves
- **Two ML Models**:
  - **Baseline A**: Shallow MLP trained on data loss only (baseline comparison)
  - **PINN**: Physics-Informed Neural Network with composite loss `L_data + 0.5·L_physics`
    - Physics constraint: SOH must be non-increasing with cycle count
    - Enforced via `L_physics = mean(ReLU(SOH(cycle + ε) − SOH(cycle)))`
- **FastAPI Service** (`backend/api/app.py`): Exposes `/health` and `/predict` endpoints
- **Docker Container**: Pre-trained models baked into image (no training at runtime)

---

## Frontend Requirements & Acceptance Criteria

### 1. Core UI Components
- [ ] **Input Form** - User can specify:
  - Profile ID (text input, e.g., "NASA_B0005")
  - C-Rate (slider or number input, 0.1–5.0)
  - Temperature (slider or number input, -20–60 °C)
  - Number of Cycles (slider or number input, 10–500)
  - "Predict" button to submit
  
- [ ] **Results Display**:
  - Side-by-side line charts comparing Real vs Baseline A vs PINN over cycles
  - Metrics table: MAE and RMSE for both models
  - Physics violations count (should be 0 for PINN, ideally ≤ baseline)
  
- [ ] **Health Status Indicator**:
  - Visual badge showing backend connection status (green = ok, red = down)
  - Fetches `/health` on app load and periodically (e.g., every 30s)

- [ ] **Error Handling**:
  - Display user-friendly error messages if request fails
  - Show validation errors for out-of-range inputs
  - Graceful handling if backend is unavailable

### 2. Technical Setup
- **Framework**: React + TypeScript (preferred)
- **Styling**: TailwindCSS or Material-UI (your choice)
- **Charts**: Recharts, Chart.js, or similar
- **API Client**: Fetch API, Axios, or React Query
- **Build Tool**: Vite (recommended) or Create React App
- **Environment Variables**:
  ```
  VITE_API_URL=http://localhost:8000  (dev)
  VITE_API_URL=https://api.example.com (prod)
  ```

### 3. Deployment
- [ ] Add `frontend/` directory to repository root
- [ ] Include `Dockerfile` for frontend (Node.js base, serve built assets)
- [ ] Update `docker-compose.yml` to include frontend service (port 3000)
- [ ] Frontend service should depend on backend (`depends_on: [backend]`)
- [ ] Update main `README.md` with frontend setup instructions

### 4. Docker Integration
Frontend should be containerized and orchestrated with backend:
```yaml
# Uncomment and complete in docker-compose.yml
frontend:
  build: ./frontend
  ports:
    - "3000:3000"
  environment:
    - VITE_API_URL=http://backend:8000
  depends_on:
    - backend
```

---

## CORS & Environment Configuration

Backend already has CORS enabled for all origins (`allow_origins=["*"]`). Frontend can hit the API directly from browser.

**Development Setup**:
```bash
# Terminal 1: Backend
docker compose up backend

# Terminal 2: Frontend dev server
cd frontend
npm install
npm run dev
```

**Production Setup**:
- Build frontend: `npm run build` → outputs `dist/`
- Docker Compose spins up both services
- Frontend communicates to backend via service name (`http://backend:8000`)

---

## Repository Structure (Current)

```
lionn_devjams26/
├── backend/                           # ✅ Complete
│   ├── api/app.py                     # FastAPI service
│   ├── data/loader.py                 # Data pipeline
│   ├── models/
│   │   ├── baseline_a.py              # Baseline model
│   │   ├── pinn.py                    # Physics-informed model
│   │   └── saved/                     # Pre-trained weights
│   ├── utils/metrics.py               # Evaluation metrics
│   └── data/{raw,processed}/          # Data storage
├── scripts/
│   ├── train.py                       # Training pipeline
│   └── docker_push.sh                 # Docker deployment
├── frontend/                          # 🟡 To be built
│   ├── src/                           # React components
│   ├── public/                        # Static assets
│   ├── Dockerfile                     # Frontend container
│   ├── package.json
│   └── vite.config.ts (or webpack.config.js)
├── Dockerfile                         # Backend container
├── docker-compose.yml                 # Orchestration
├── requirements.txt                   # Python deps
├── README.md                          # Project docs (update with frontend setup)
└── .gitignore
```

---

## Key Notes for Frontend Dev

1. **API Response Time**: Backend responds in ~6-7ms per prediction (very fast)
2. **Model Comparison**: PINN should have fewer physics violations than Baseline A
3. **Synthetic Data**: If no NASA .mat files in `backend/data/raw/`, backend uses synthetic SOH curves (exp decay + noise)
4. **Profile IDs**: Real data uses "NASA_B####" (e.g., B0005, B0006, B0007, B0018); synthetic uses "SYNTH_###"
5. **CORS Ready**: No special CORS configuration needed on frontend side
6. **Validation**: Input ranges are enforced on backend; frontend should validate before sending for UX

---

## Testing Checklist for Frontend Dev

- [ ] App loads and backend health check passes (`/health` returns ok)
- [ ] Form accepts valid input and submit works
- [ ] API response received and charts render correctly
- [ ] Metrics table displays MAE/RMSE for both models
- [ ] Physics violations count displayed (should be 0 for PINN)
- [ ] Error messages display if backend is unavailable
- [ ] Form resets after successful prediction
- [ ] Works locally with `docker compose up`
- [ ] Responsive design (mobile-friendly)
- [ ] Accessible (WCAG 2.1 AA level recommended)

---

## Helpful Links & References

- **Backend Repo**: https://github.com/sarvajithsankar/lionn_devjams26
- **API Docs (Live)**: http://localhost:8000/docs (Swagger UI auto-generated by FastAPI)
- **Docker Hub Image**: https://hub.docker.com/r/sarvajithsankar/battery-health-predictor
- **NASA Battery Dataset**: https://www.nasa.gov/content/prognostics-center-of-excellence-data-set-repository

---

## Summary for Coding Agent

**Task**: Build a React frontend dashboard that:
1. Accepts user input (profile_id, c_rate, temperature, n_cycles)
2. Sends POST request to backend `/predict` endpoint
3. Displays results: line charts (Real vs Baseline A vs PINN), metrics table, physics violations
4. Shows backend health status
5. Containerized with Dockerfile and integrated into docker-compose.yml

**Backend is production-ready and waiting for frontend integration.**

---

*Generated for Web-Acharis team | LIONN Project | DevJams 2026*
