// src/components/TrajectoryChart.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { Activity } from 'lucide-react';

interface TrajectoryChartProps {
  cycles: number[];
  groundTruth: (number | null)[];
  groundTruthType?: 'measured' | 'simulated' | string;
  capacityBaselineMlp: number[];
  capacityPinn: number[];
}

export const TrajectoryChart: React.FC<TrajectoryChartProps> = ({
  cycles,
  groundTruth,
  capacityBaselineMlp,
  capacityPinn,
}) => {
  const [showGroundTruth, setShowGroundTruth] = useState(true);
  const [showBaselineMlp, setShowBaselineMlp] = useState(true);
  const [showPinn, setShowPinn] = useState(true);

  // Staggered sequential draw-in animation
  const [animStage, setAnimStage] = useState<number>(0);

  useEffect(() => {
    setAnimStage(1);
    const t1 = setTimeout(() => setAnimStage(2), 700);
    const t2 = setTimeout(() => setAnimStage(3), 1400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Transform data for Recharts
  const chartData = useMemo(() => {
    return cycles.map((cycle, i) => ({
      cycle,
      groundTruth: groundTruth[i] ?? null,
      baselineMlp: capacityBaselineMlp[i],
      pinn: capacityPinn[i],
    }));
  }, [cycles, groundTruth, capacityBaselineMlp, capacityPinn]);

  return (
    <div className="w-full space-y-8">
      
      {/* Header Row: Waveform Icon + Tracked-Out Label + Flat Toggle Chips */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        
        {/* Waveform Icon + Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-center justify-center text-[#0284c7] shrink-0 shadow-sm">
            <Activity className="w-4 h-4 stroke-[2]" />
          </div>
          <h3 className="text-base sm:text-lg font-space font-bold text-slate-900 tracking-[0.04em]">
            Capacity Degradation Trajectory (Ah vs Cycles)
          </h3>
        </div>

        {/* 5. Typography Refinement: Tracked-out Toggle Labels */}
        <div className="flex flex-wrap items-center gap-3 select-none">
          <button
            type="button"
            onClick={() => setShowGroundTruth(!showGroundTruth)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-[0.12em] uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 ${
              showGroundTruth
                ? 'bg-slate-200/90 text-slate-800 shadow-sm'
                : 'bg-transparent text-slate-400 opacity-40 hover:opacity-70'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Ground Truth</span>
          </button>

          <button
            type="button"
            onClick={() => setShowBaselineMlp(!showBaselineMlp)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-[0.12em] uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 ${
              showBaselineMlp
                ? 'bg-amber-100/90 text-amber-900 shadow-sm'
                : 'bg-transparent text-slate-400 opacity-40 hover:opacity-70'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Baseline MLP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPinn(!showPinn)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-mono font-bold tracking-[0.12em] uppercase transition-all duration-200 cursor-pointer flex items-center gap-2 ${
              showPinn
                ? 'bg-sky-100/90 text-sky-900 shadow-sm'
                : 'bg-transparent text-slate-400 opacity-40 hover:opacity-70'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
            <span>PINN (Physics)</span>
          </button>
        </div>

      </div>

      {/* Chart Plotting Area: Light Translucent Inner Card */}
      <div className="w-full rounded-[24px] bg-white/60 backdrop-blur-xl border border-white/90 p-5 sm:p-7 shadow-[0_8px_24px_rgba(2,132,199,0.04)]">
        <div className="w-full h-[360px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 15, left: -15, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
              
              {/* 2. Darkened Axis Lines & Tick Labels for Clear Contrast */}
              <XAxis
                dataKey="cycle"
                stroke="#475569"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={{ stroke: '#64748b', strokeWidth: 1.2 }}
                dy={8}
                label={{
                  value: 'Equivalent Full Cycles (FEC)',
                  fill: '#334155',
                  fontSize: 11,
                  fontWeight: 600,
                  position: 'insideBottom',
                  dy: 16
                }}
              />
              
              <YAxis
                stroke="#475569"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                axisLine={{ stroke: '#64748b', strokeWidth: 1.2 }}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${v.toFixed(2)} Ah`}
              />
              
              {/* EOL Reference Line */}
              <ReferenceLine
                y={0.88}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeOpacity={0.85}
                strokeWidth={1.2}
                label={{
                  value: '80% EOL',
                  fill: '#dc2626',
                  fontSize: 10,
                  fontWeight: 700,
                  position: 'insideBottomRight',
                  opacity: 0.95
                }}
              />

              {/* Synchronized Crosshair Tooltip */}
              <Tooltip
                cursor={{ stroke: '#0284c7', strokeWidth: 1.2, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 p-3.5 shadow-xl space-y-1.5 font-mono text-xs">
                      <div className="text-slate-500 text-[11px] pb-1 border-b border-slate-100 font-semibold">
                        Cycle: <strong className="text-slate-900">{label}</strong>
                      </div>
                      {payload.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-600">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                          </span>
                          <span className="font-bold text-slate-900">
                            {typeof entry.value === 'number' ? `${entry.value.toFixed(4)} Ah` : 'N/A'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />

              {/* Data Lines */}
              {showGroundTruth && animStage >= 1 && (
                <Line
                  type="monotone"
                  dataKey="groundTruth"
                  name="Ground Truth"
                  stroke="#475569"
                  strokeWidth={1.75}
                  dot={false}
                  strokeDasharray="3 3"
                  animationDuration={750}
                  animationEasing="ease-out"
                />
              )}

              {showBaselineMlp && animStage >= 2 && (
                <Line
                  type="monotone"
                  dataKey="baselineMlp"
                  name="Baseline MLP"
                  stroke="#f59e0b"
                  strokeWidth={2.25}
                  dot={false}
                  animationDuration={750}
                  animationEasing="ease-out"
                />
              )}

              {showPinn && animStage >= 3 && (
                <Line
                  type="monotone"
                  dataKey="pinn"
                  name="PINN (Physics)"
                  stroke="#0284c7"
                  strokeWidth={2.75}
                  dot={false}
                  animationDuration={750}
                  animationEasing="ease-out"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Two Elevated Equation Cards: Custom SVG Sparklines + Oversized Comparison Symbol Watermarks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
        
        {/* CARD 1: Unconstrained Baseline MLP */}
        <div className="relative rounded-[24px] bg-white/70 backdrop-blur-xl border border-white/80 overflow-hidden flex shadow-[0_6px_20px_rgba(0,0,0,0.02)]">
          {/* Amber Accent Bar */}
          <div className="w-1.5 bg-amber-500 shrink-0" />
          
          {/* Subtle Oversized Background Comparison Symbol Watermark ">" */}
          <div className="absolute right-3 -bottom-4 select-none pointer-events-none font-mono font-black text-8xl text-amber-500/[0.07] leading-none">
            &gt;
          </div>

          <div className="relative z-10 flex-1 p-6 space-y-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500 block">
              Unconstrained Baseline MLP
            </span>

            {/* Prominent Equation + Custom Unstable Oscillating Sparkline SVG */}
            <div className="flex items-center gap-3.5">
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-600 tracking-tight">
                ∂Q/∂t &gt; 0
              </div>
              <svg className="w-8 h-6 text-amber-500 shrink-0 overflow-visible" viewBox="0 0 32 20" fill="none">
                <path
                  d="M2 14 L8 15 L14 4 L20 16 L26 8 L30 11"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="text-xs font-sans text-slate-600 leading-relaxed pt-0.5">
              Exhibits non-monotonic capacity increases and unphysical variance outside training boundaries.
            </p>
          </div>
        </div>

        {/* CARD 2: PINN Regularization */}
        <div className="relative rounded-[24px] bg-white/70 backdrop-blur-xl border border-white/80 overflow-hidden flex shadow-[0_6px_20px_rgba(0,0,0,0.02)]">
          {/* Cyan/Blue Accent Bar */}
          <div className="w-1.5 bg-[#0284c7] shrink-0" />
          
          {/* Subtle Oversized Background Comparison Symbol Watermark "≤" */}
          <div className="absolute right-3 -bottom-4 select-none pointer-events-none font-mono font-black text-8xl text-[#0284c7]/[0.07] leading-none">
            ≤
          </div>

          <div className="relative z-10 flex-1 p-6 space-y-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500 block">
              PINN Regularization
            </span>

            {/* Prominent Equation + Custom Smooth Monotonic Decaying Sparkline SVG */}
            <div className="flex items-center gap-3.5">
              <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[#0284c7] tracking-tight">
                ∂Q/∂t ≤ 0
              </div>
              <svg className="w-8 h-6 text-[#0284c7] shrink-0 overflow-visible" viewBox="0 0 32 20" fill="none">
                <path
                  d="M2 4 C10 4, 18 10, 30 16"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <p className="text-xs font-sans text-slate-600 leading-relaxed pt-0.5">
              Strictly enforces monotonic thermodynamic decay constraint through embedded kinetic loss terms.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};