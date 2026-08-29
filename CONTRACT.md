# LIONN API Contract

POST /predict

## Request
{
  "battery_id": "batch5_cell3",
  "c_rate": 1.5,
  "ambient_temp_C": 35,
  "cycle_range": [0, 300]
}

## Response
{
  "cycles": [0, 1, 2],
  "ground_truth": [2.0, 1.999, null],
  "capacity_baseline_mlp": [2.0, 2.001],
  "capacity_pinn": [2.0, 1.997],
  "metrics": {
    "rmse_baseline_mlp": 0.041,
    "rmse_pinn": 0.019,
    "mape_baseline_mlp": 2.1,
    "mape_pinn": 0.9,
    "physics_violation_index_baseline_mlp": 12.4,
    "physics_violation_index_pinn": 0.0
  },
  "physics_loss_trace": {
    "epoch": [0, 1, 2],
    "data_loss": [0.5, 0.3],
    "physics_loss": [0.8, 0.4]
  },
  "rul": {
    "rul_baseline_mlp": 145,
    "rul_pinn": 138,
    "rul_ground_truth": 140
  }
}
