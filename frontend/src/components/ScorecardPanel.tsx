// src/components/ScorecardPanel.tsx
import React, { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export interface ScorecardMetrics {
  baseline_rmse?: number;
  pinn_rmse?: number;
  baseline_pvi?: number;
  pinn_pvi?: number;
  rmse_baseline?: number;
  rmse_pinn?: number;
  pvi_baseline?: number;
  pvi_pinn?: number;
  [key: string]: any;
}

interface ScorecardPanelProps {
  metrics?: ScorecardMetrics | any;
  cycles?: number[];
  groundTruth?: (number | null)[];
  capacityBaselineMlp?: number[];
  capacityPinn?: number[];
}

export const ScorecardPanel: React.FC<ScorecardPanelProps> = ({
  metrics,
  cycles,
  groundTruth,
  capacityBaselineMlp,
  capacityPinn,
}) => {
  // Dynamically compute stats from raw trajectory arrays if metrics object is missing
  const computedStats = useMemo(() => {
    if (!cycles || cycles.length === 0 || !capacityBaselineMlp || !capacityPinn) {
      return null;
    }

    const N = cycles.length;
    let mlpSqErrorSum = 0;
    let pinnSqErrorSum = 0;
    let validGtCount = 0;

    // Normalize GT against cycle 0 if needed
    const initialCap = groundTruth?.find((v) => typeof v === 'number' && v > 0) ?? 1.0;

    for (let i = 0; i < N; i++) {
      const rawGt = groundTruth?.[i];
      if (typeof rawGt === 'number') {
        const normGt = rawGt > 1.5 ? rawGt / initialCap : rawGt;
        mlpSqErrorSum += Math.pow(capacityBaselineMlp[i] - normGt, 2);
        pinnSqErrorSum += Math.pow(capacityPinn[i] - normGt, 2);
        validGtCount++;
      }
    }

    // Monotonicity Physics Violation Index (dQ/dt > 0)
    let mlpViolations = 0;
    let pinnViolations = 0;
    for (let i = 1; i < N; i++) {
      if (capacityBaselineMlp[i] > capacityBaselineMlp[i - 1]) mlpViolations++;
      if (capacityPinn[i] > capacityPinn[i - 1]) pinnViolations++;
    }

    return {
      baselineRmse: validGtCount > 0 ? Math.sqrt(mlpSqErrorSum / validGtCount) : 0,
      pinnRmse: validGtCount > 0 ? Math.sqrt(pinnSqErrorSum / validGtCount) : 0,
      baselinePvi: N > 1 ? mlpViolations / (N - 1) : 0,
      pinnPvi: N > 1 ? pinnViolations / (N - 1) : 0,
    };
  }, [cycles, groundTruth, capacityBaselineMlp, capacityPinn]);

  // Priority: Direct props metrics -> Dynamic trajectory calculations -> Safe 0 default
  const baselineRmse =
    metrics?.baseline_rmse ??
    metrics?.rmse_baseline ??
    computedStats?.baselineRmse ??
    0;

  const pinnRmse =
    metrics?.pinn_rmse ??
    metrics?.rmse_pinn ??
    computedStats?.pinnRmse ??
    0;

  const baselinePvi =
    metrics?.baseline_pvi ??
    metrics?.pvi_baseline ??
    computedStats?.baselinePvi ??
    0;

  const pinnPvi =
    metrics?.pinn_pvi ??
    metrics?.pvi_pinn ??
    computedStats?.pinnPvi ??
    0;

  const rmseImprovement =
    baselineRmse > 0
      ? (((baselineRmse - pinnRmse) / baselineRmse) * 100).toFixed(1)
      : '0.0';

  // Calculate relative bar widths
  const maxRmse = Math.max(baselineRmse, pinnRmse, 0.0001);
  const baselineWidthPct = Math.min(100, Math.max(10, (baselineRmse / maxRmse) * 100));
  const pinnWidthPct = Math.min(100, Math.max(6, (pinnRmse / maxRmse) * 100));

  return (
    <div className="space-y-6">
      {/* Header Row: Minimal Custom Sliders/Scale Icon + Compact Fidelity Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0284c7] shadow-sm">
            <SlidersHorizontal className="w-4 h-4 stroke-[2]" />
          </div>
          <h4 className="text-base sm:text-lg font-space font-bold text-slate-900 tracking-wide">
            Diagnostic Scorecard
          </h4>
        </div>

        {/* Compact Dynamic Fidelity Badge */}
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          +{rmseImprovement}% Fidelity
        </span>
      </div>

      {/* Two Metric Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Baseline Card */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500">
              Baseline MLP
            </span>
            {/* Dynamic Baseline PVI Chip */}
            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-mono font-bold text-amber-700">
              PVI {(Number(baselinePvi) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-mono font-bold text-slate-900">
              {Number(baselineRmse).toFixed(4)}{' '}
              <span className="text-xs font-normal text-slate-500">RMSE</span>
            </div>

            {/* Direct Visual Comparison Bar (Amber) */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${baselineWidthPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* PINN Model Card */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500">
              PINN Model
            </span>
            {/* Dynamic PINN PVI Chip (No longer hardcoded to 0.0%) */}
            <span className="px-2 py-0.5 rounded-md bg-sky-50 border border-sky-200 text-[11px] font-mono font-bold text-[#0284c7]">
              PVI {(Number(pinnPvi) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-mono font-bold text-[#0284c7]">
              {Number(pinnRmse).toFixed(4)}{' '}
              <span className="text-xs font-normal text-slate-500">RMSE</span>
            </div>

            {/* Direct Visual Comparison Bar (Cyan/Blue) */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className="bg-[#0284c7] h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pinnWidthPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};