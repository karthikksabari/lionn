import { PredictRequest, PredictResponse } from '../types';
import sampleResponse from '../mock/sampleResponse.json';

/**
 * Simulates battery degradation dynamics under physics-informed vs unconstrained MLP models.
 * Calculates dynamic metrics, capacity trajectories, and physics violations based on C-rate,
 * ambient temperature, and cycle range.
 */
function generateDynamicPrediction(request: PredictRequest): PredictResponse {
  const [startCycle, endCycle] = request.cycle_range;
  const numPoints = 25;
  const step = Math.max(1, Math.floor((endCycle - startCycle) / (numPoints - 1)));
  
  const cycles: number[] = [];
  for (let c = startCycle; c <= endCycle; c += step) {
    cycles.push(c);
  }
  if (cycles[cycles.length - 1] !== endCycle) {
    cycles.push(endCycle);
  }

  // Nominal initial capacity in Ah
  const nominalCapacity = 1.10;
  // End of Life (EOL) capacity threshold (typically 80% or 70% of nominal)
  const eolThreshold = nominalCapacity * 0.727; // ~0.80 Ah

  // Arrhenius & C-rate acceleration factor
  const tempKelvin = request.ambient_temp_C + 273.15;
  const baseTempKelvin = 298.15; // 25°C
  const arrheniusFactor = Math.exp((5000 / 8.314) * (1 / baseTempKelvin - 1 / tempKelvin));
  const cRateMultiplier = Math.pow(request.c_rate / 1.0, 1.15);
  const degradationRate = 0.00032 * arrheniusFactor * cRateMultiplier;

  const groundTruth: (number | null)[] = [];
  const capacityPinn: number[] = [];
  const capacityBaselineMlp: number[] = [];

  // Ground truth is known up to ~75% of the operational lifespan
  const knownCutoffCycle = startCycle + (endCycle - startCycle) * 0.72;

  let mlpViolations = 0;
  let prevMlpVal = nominalCapacity;

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    
    // Exact physical curve with SEI growth (sqrt(t)) and transition to non-linear knee point
    const linearWear = degradationRate * cycle;
    const nonLinearKnee = Math.pow(Math.max(0, cycle - 550) / 400, 2.4) * 0.12;
    const trueCap = Math.max(0.05, nominalCapacity - linearWear - nonLinearKnee);

    // Ground truth (null after cutoff to simulate forecasting horizon)
    if (cycle <= knownCutoffCycle) {
      // Add slight experimental sensor noise (+/- 0.002 Ah)
      const noise = Math.sin(cycle * 0.08) * 0.0015;
      groundTruth.push(Number((trueCap + noise).toFixed(4)));
    } else {
      groundTruth.push(null);
    }

    // PINN Model: Preserves monotonicity dQ/dt <= 0 and respects electrochemical boundaries
    const pinnCap = Number((trueCap + Math.sin(cycle * 0.03) * 0.0008).toFixed(4));
    capacityPinn.push(pinnCap);

    // Baseline MLP Model: Overfits training region, exhibits unphysical oscillations/rebounds
    // or drastic exponential collapse on out-of-distribution conditions
    let mlpCap = trueCap;
    if (cycle <= knownCutoffCycle) {
      // High frequency training wobble
      mlpCap += Math.sin(cycle * 0.15) * 0.012 - (cycle / endCycle) * 0.008;
    } else {
      // Extrapolation divergence: artificial capacity recovery (physics violation) or sudden crash
      const outOfDistFactor = (cycle - knownCutoffCycle) / (endCycle - knownCutoffCycle);
      const unphysicalRebound = Math.sin(outOfDistFactor * Math.PI * 2.5) * 0.045;
      const extrapolationDrift = -Math.pow(outOfDistFactor, 1.8) * 0.18;
      mlpCap = trueCap + unphysicalRebound + extrapolationDrift;
    }

    const mlpValFixed = Number(Math.max(0.05, mlpCap).toFixed(4));
    capacityBaselineMlp.push(mlpValFixed);

    // Detect non-monotonicity (capacity increasing with cycle number = violation)
    if (i > 0 && mlpValFixed > prevMlpVal + 0.001) {
      mlpViolations += (mlpValFixed - prevMlpVal);
    }
    prevMlpVal = mlpValFixed;
  }

  // Calculate error metrics only over the known ground truth points
  const validIndices = groundTruth
    .map((val, idx) => (val !== null ? idx : -1))
    .filter((idx) => idx !== -1);

  let sumSqErrMlp = 0;
  let sumSqErrPinn = 0;
  let sumAbsPctErrMlp = 0;
  let sumAbsPctErrPinn = 0;

  for (const idx of validIndices) {
    const actual = groundTruth[idx] as number;
    const predMlp = capacityBaselineMlp[idx];
    const predPinn = capacityPinn[idx];

    sumSqErrMlp += Math.pow(predMlp - actual, 2);
    sumSqErrPinn += Math.pow(predPinn - actual, 2);

    sumAbsPctErrMlp += Math.abs((predMlp - actual) / actual);
    sumAbsPctErrPinn += Math.abs((predPinn - actual) / actual);
  }

  const n = validIndices.length || 1;
  const rmseBaselineMlp = Number(Math.sqrt(sumSqErrMlp / n).toFixed(4));
  const rmsePinn = Number(Math.sqrt(sumSqErrPinn / n).toFixed(4));
  const mapeBaselineMlp = Number(((sumAbsPctErrMlp / n) * 100).toFixed(2));
  const mapePinn = Number(((sumAbsPctErrPinn / n) * 100).toFixed(2));

  // Physics violation index
  const pviMlp = Number((mlpViolations * 2.5 + (request.c_rate > 2 ? 0.08 : 0.03)).toFixed(3));
  const pviPinn = 0.0;

  // Remaining Useful Life calculation (cycle count when reaching EOL threshold)
  const findRulCycle = (series: number[]): number => {
    for (let i = 0; i < series.length; i++) {
      if (series[i] <= eolThreshold) {
        return cycles[i];
      }
    }
    return cycles[cycles.length - 1] + 120;
  };

  const trueRulCycle = 785;
  const pinnRulCycle = findRulCycle(capacityPinn);
  const mlpRulCycle = findRulCycle(capacityBaselineMlp);

  return {
    cycles,
    ground_truth: groundTruth,
    capacity_baseline_mlp: capacityBaselineMlp,
    capacity_pinn: capacityPinn,
    metrics: {
      rmse_baseline_mlp: rmseBaselineMlp,
      rmse_pinn: rmsePinn,
      mape_baseline_mlp: mapeBaselineMlp,
      mape_pinn: mapePinn,
      physics_violation_index_baseline_mlp: pviMlp,
      physics_violation_index_pinn: pviPinn,
    },
    physics_loss_trace: sampleResponse.physics_loss_trace,
    rul: {
      rul_baseline_mlp: mlpRulCycle,
      rul_pinn: pinnRulCycle,
      rul_ground_truth: trueRulCycle,
    },
  };
}

/**
 * Executes battery degradation prediction.
 * Includes a mandatory artificial ~500ms latency to showcase loading feedback.
 */
export async function predictBatteryHealth(request: PredictRequest): Promise<PredictResponse> {
  // Simulate network & PINN inference execution delay (500ms)
  await new Promise((resolve) => setTimeout(resolve, 520));

  try {
    return generateDynamicPrediction(request);
  } catch (err) {
    console.error('Error generating battery health prediction:', err);
    // Fallback to static sample response
    return sampleResponse as PredictResponse;
  }
}