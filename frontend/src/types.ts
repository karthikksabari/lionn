export interface PredictRequest {
  battery_id: string;
  c_rate: number;
  ambient_temp_C: number;
  cycle_range: [number, number];
}

export interface Metrics {
  rmse_baseline_mlp: number;
  rmse_pinn: number;
  mape_baseline_mlp: number;
  mape_pinn: number;
  physics_violation_index_baseline_mlp: number;
  physics_violation_index_pinn: number;
}

export interface PhysicsLossTrace {
  epoch: number[];
  data_loss: number[];
  physics_loss: number[];
}

export interface RulPrediction {
  rul_baseline_mlp: number;
  rul_pinn: number;
  rul_ground_truth: number;
}

export interface PredictResponse {
  cycles: number[];
  ground_truth: (number | null)[];
  capacity_baseline_mlp: number[];
  capacity_pinn: number[];
  metrics: Metrics;
  physics_loss_trace: PhysicsLossTrace;
  rul: RulPrediction;
}

export interface BatteryScenarioPreset {
  id: string;
  name: string;
  description: string;
  defaultCrate: number;
  defaultTemp: number;
  defaultCycleRange: [number, number];
  tag: string;
}