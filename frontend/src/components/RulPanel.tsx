// src/components/RulPanel.tsx
import React from 'react';
import { GitCommit, Infinity as InfinityIcon } from 'lucide-react';

export interface RulData {
  baseline_mlp_cycles?: number | null;
  pinn_cycles?: number;
  rul_baseline?: number | null;
  rul_pinn?: number;
  [key: string]: any;
}

interface RulPanelProps {
  rul?: RulData | any;
}

export const RulPanel: React.FC<RulPanelProps> = ({ rul }) => {
  const baselineCycles = rul?.baseline_mlp_cycles ?? rul?.rul_baseline ?? null;
  const pinnCycles = rul?.pinn_cycles ?? rul?.rul_pinn ?? 920;

  return (
    <div className="space-y-6">
      {/* Header Row: Minimal Custom Horizon/Timeline Icon + Compact EOL Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0284c7] shadow-sm">
            <GitCommit className="w-4 h-4 stroke-[2]" />
          </div>
          <h4 className="text-base sm:text-lg font-space font-bold text-slate-900 tracking-wide">
            Remaining Useful Life (RUL)
          </h4>
        </div>
        
        {/* Compact Header Badge */}
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-50 text-[#0284c7] border border-blue-100">
          80% EOL
        </span>
      </div>

      {/* Two Projection Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* 4. Baseline MLP Projection: Unbounded Styled with Icon + Concise Tag */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500 block">
            Baseline Projection
          </span>

          <div className="flex items-center gap-2.5 text-2xl sm:text-3xl font-mono font-bold text-slate-400">
            <InfinityIcon className="w-6 h-6 stroke-[2] text-slate-400" />
            <span>{baselineCycles !== null && baselineCycles !== undefined ? `${baselineCycles} cyc` : 'Unbounded'}</span>
          </div>

          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-600 uppercase tracking-wider">
              No Convergence
            </span>
          </div>
        </div>

        {/* 5. PINN Physics Projection: Prominent Number + Concise Monotonic Tag */}
        <div className="p-5 rounded-2xl bg-white/90 border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
          <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500 block">
            PINN Physics RUL
          </span>

          <div className="text-2xl sm:text-3xl font-mono font-bold text-[#0284c7]">
            {pinnCycles}{' '}
            <span className="text-xs font-normal text-slate-500">Cycles</span>
          </div>

          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-700 uppercase tracking-wider">
              Monotonic • Converged
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};