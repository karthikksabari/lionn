// src/components/InputPanel.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PredictRequest } from '../types';
import { ArrowRight, ChevronDown, Check, Gauge, Activity, Infinity as InfinityIcon } from 'lucide-react';

interface InputPanelProps {
  onRunPrediction: (request: PredictRequest) => void;
  isLoading: boolean;
  initialRequest?: PredictRequest;
}

const PRESET_SCENARIOS = [
  {
    id: 'battery_unseen_fast_charge_profile_A',
    name: 'Unseen Fast-Charge Profile A (3.5C)',
    c_rate: 3.5,
    temp: 45.0,
    cycles: 1000,
  },
  {
    id: 'battery_unseen_fast_charge_profile_B',
    name: 'Unseen Fast-Charge Profile B (4.2C)',
    c_rate: 4.2,
    temp: 50.0,
    cycles: 1000,
  },
  {
    id: 'battery_cold_temperature_stress',
    name: 'Cold Weather Accelerated Degradation (-5°C)',
    c_rate: 2.0,
    temp: -5.0,
    cycles: 800,
  }
];

export const InputPanel: React.FC<InputPanelProps> = ({
  onRunPrediction,
  isLoading,
  initialRequest,
}) => {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    initialRequest?.battery_id || PRESET_SCENARIOS[0].id
  );
  const [cRate, setCRate] = useState<number>(initialRequest?.c_rate ?? 3.5);
  const [ambientTemp, setAmbientTemp] = useState<number>(initialRequest?.ambient_temp_C ?? 45.0);
  const [cycleHorizon, setCycleHorizon] = useState<number>(initialRequest?.cycle_range[1] ?? 1000);
  
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setSelectedScenarioId(preset.id);
    setCRate(preset.c_rate);
    setAmbientTemp(preset.temp);
    setCycleHorizon(preset.cycles);
    setIsPresetOpen(false);
  };

  const handleManualCRateChange = (val: number) => {
    setSelectedScenarioId(null);
    setCRate(val);
  };

  const handleManualTempChange = (val: number) => {
    setSelectedScenarioId(null);
    setAmbientTemp(val);
  };

  const handleManualCycleChange = (val: number) => {
    setSelectedScenarioId(null);
    setCycleHorizon(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunPrediction({
      battery_id: selectedScenarioId || 'custom_user_scenario',
      c_rate: Number(cRate),
      ambient_temp_C: Number(ambientTemp),
      cycle_range: [0, Number(cycleHorizon)],
    });
  };

  // Color-reactive temperature glow calculations
  const { tempGlowStyle, isFreezing, isOverheating, batteryOutlineClass } = useMemo(() => {
    let glowColor = '';
    let glowBlur = 45;
    const freezing = ambientTemp <= -10;
    const overheating = ambientTemp >= 50;

    if (ambientTemp <= -10) {
      const t = Math.min(1, (-10 - ambientTemp) / 10);
      glowColor = `rgba(56, 115, 255, ${0.45 + t * 0.25})`;
      glowBlur = 55;
    } else if (ambientTemp < 10) {
      const t = (10 - ambientTemp) / 20;
      glowColor = `rgba(2, 132, 199, ${0.15 + t * 0.3})`;
      glowBlur = 40;
    } else if (ambientTemp <= 30) {
      glowColor = 'rgba(255, 255, 255, 0.2)';
      glowBlur = 25;
    } else if (ambientTemp < 50) {
      const t = (ambientTemp - 30) / 20;
      glowColor = `rgba(245, 158, 11, ${0.2 + t * 0.35})`;
      glowBlur = 50;
    } else {
      const t = Math.min(1, (ambientTemp - 50) / 15);
      glowColor = `rgba(239, 68, 68, ${0.55 + t * 0.35})`;
      glowBlur = 65;
    }

    let outline = 'border-slate-300';
    if (freezing) outline = 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]';
    if (overheating) outline = 'border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.6)]';

    return {
      tempGlowStyle: {
        backgroundColor: glowColor,
        filter: `blur(${glowBlur}px)`,
      },
      isFreezing: freezing,
      isOverheating: overheating,
      batteryOutlineClass: outline,
    };
  }, [ambientTemp]);

  const pulseDuration = useMemo(() => {
    const clamped = Math.max(0.5, Math.min(5.0, cRate));
    return `${2.2 - ((clamped - 0.5) / 4.5) * 1.7}s`;
  }, [cRate]);

  const activeSegments = useMemo(() => {
    return Math.min(5, Math.max(1, Math.round((cRate / 5.0) * 5)));
  }, [cRate]);

  const cRatePercent = Math.min(100, Math.max(0, ((cRate - 0.5) / (5.0 - 0.5)) * 100));
  const tempPercent = Math.min(100, Math.max(0, ((ambientTemp - (-20)) / (65 - (-20))) * 100));
  const cyclePercent = Math.min(100, Math.max(0, ((cycleHorizon - 100) / (2000 - 100)) * 100));

  // 1. FIX "Preset: undefined" BUG by checking whether a valid preset actually matches
  const activePresetObj = PRESET_SCENARIOS.find((s) => s.id === selectedScenarioId);
  const modeLabel = activePresetObj 
    ? `Preset: ${activePresetObj.name.split('(')[0].trim()}` 
    : 'User (Custom)';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto h-[78vh] max-h-[820px] flex flex-col justify-center">
      
      {/* Side-by-Side 2-Column Grid */}
      <div className="w-full h-full flex flex-row items-stretch gap-6">
        
        {/* ================= LEFT COLUMN (~40% Width) ================= */}
        <div className="w-[40%] h-full rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/70 p-6 flex flex-col justify-between shadow-[0_16px_40px_rgba(2,132,199,0.06)] overflow-hidden">
          
          {/* Header Row: Mode Label & Preset Dropdown */}
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                Operating Mode
              </span>
              <span className="text-xs font-['Space_Grotesk'] font-bold text-slate-800 truncate max-w-[170px]">
                {modeLabel}
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsPresetOpen(!isPresetOpen)}
                className={`h-[38px] px-4 rounded-full border text-xs font-['Space_Grotesk'] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shadow-sm ${
                  activePresetObj
                    ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-[0_4px_12px_rgba(2,132,199,0.25)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>Preset</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPresetOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPresetOpen && (
                <div className="absolute top-11 right-0 z-50 w-72 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] space-y-1 animate-fadeIn">
                  {PRESET_SCENARIOS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-semibold transition-colors flex items-center justify-between ${
                        selectedScenarioId === preset.id
                          ? 'bg-blue-50 text-[#0284c7]'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate pr-2">{preset.name}</span>
                      {selectedScenarioId === preset.id && <Check className="w-3.5 h-3.5 shrink-0 text-[#0284c7]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 2 & 3. Reduced Inner White Battery Card (~22% smaller height, balanced vertical margins) */}
          <div className="relative my-auto w-full max-w-[390px] mx-auto h-[78%] max-h-[640px] rounded-[24px] bg-white border border-slate-200/70 p-4 flex flex-col items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.02)] overflow-hidden">
            
            {/* Dynamic Temperature Glow */}
            <div
              className="absolute w-[170px] h-[240px] rounded-full pointer-events-none transition-all duration-700 ease-out"
              style={tempGlowStyle}
            />

            {/* Frost Overlay */}
            {isFreezing && (
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-cyan-200/25 via-blue-100/10 to-transparent border-t-2 border-cyan-300" />
            )}

            {/* Heat Shimmer */}
            {isOverheating && (
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-red-500/10 via-orange-400/5 to-transparent animate-pulse" />
            )}

            {/* Proportionally Scaled Battery body */}
            <div className="relative z-10 w-[125px] sm:w-[138px] h-[230px] sm:h-[255px] flex flex-col items-center">
              <div className="w-11 h-3.5 rounded-t-md bg-slate-300 border-2 border-b-0 border-slate-400/80" />

              <div className={`w-full flex-1 rounded-[18px] border-[3px] ${batteryOutlineClass} bg-slate-50/90 p-2 flex flex-col-reverse justify-between gap-1.5 shadow-inner transition-all duration-500`}>
                {[1, 2, 3, 4, 5].map((segIndex) => {
                  const isFilled = segIndex <= activeSegments;
                  return (
                    <div
                      key={segIndex}
                      className={`w-full h-[36px] rounded-lg transition-all duration-300 ${
                        isFilled
                          ? isOverheating
                            ? 'bg-gradient-to-r from-orange-500 via-red-500 to-amber-500 shadow-[0_2px_8px_rgba(239,68,68,0.4)]'
                            : isFreezing
                            ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-[0_2px_8px_rgba(6,182,212,0.4)]'
                            : 'bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#2563eb] shadow-[0_2px_8px_rgba(2,132,199,0.3)]'
                          : 'bg-slate-200/60'
                      }`}
                      style={{
                        animation: isFilled ? `pulseGlow ${pulseDuration} infinite ease-in-out` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>

          </div>

          {/* 3. Dedicated Target Cycles Readout occupying bottom of the left column */}
          <div className="pt-2 text-center shrink-0">
            <span className="font-mono text-xs font-semibold text-slate-500 tracking-wider">
              Target: <strong className="text-slate-800">{cycleHorizon} cycles</strong>
            </span>
          </div>

        </div>

        {/* ================= RIGHT COLUMN (~60% Width) ================= */}
        <div className="w-[60%] h-full rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/70 p-6 sm:p-8 flex flex-col justify-between shadow-[0_16px_40px_rgba(2,132,199,0.06)]">
          
          {/* 4. Enlarged Three Input Rows with increased vertical gaps (130-140px height) */}
          <div className="flex-1 flex flex-col justify-center gap-5">
            
            {/* ROW 1: Ambient Temperature */}
            <div className="h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              {/* 5. Distinctive Semicircular Gauge Dial Icon */}
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0284c7] shrink-0 shadow-sm">
                  <Gauge className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-wider text-slate-800 leading-tight">
                    Ambient Temp
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Operating climate
                  </span>
                </div>
              </div>

              <div className="flex-1 px-4">
                <input
                  type="range"
                  min="-20"
                  max="65"
                  step="1"
                  value={ambientTemp}
                  onMouseDown={() => setActiveSlider('temp')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('temp')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualTempChange(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${tempPercent}%, #e2e8f0 ${tempPercent}%, #e2e8f0 100%)`
                  }}
                  className={`w-full h-3 rounded-lg appearance-none cursor-pointer accent-[#0284c7] transition-all ${
                    activeSlider === 'temp' ? 'scale-y-125' : ''
                  }`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  min="-40"
                  max="85"
                  step="1"
                  value={ambientTemp}
                  onChange={(e) => handleManualTempChange(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">°C</span>
              </div>
            </div>

            {/* ROW 2: Charge Rate (C-Rate) */}
            <div className="h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              {/* 5. Distinctive Pulse / Waveform Icon */}
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0284c7] shrink-0 shadow-sm">
                  <Activity className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-wider text-slate-800 leading-tight">
                    Charge Rate
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Current draw
                  </span>
                </div>
              </div>

              <div className="flex-1 px-4">
                <input
                  type="range"
                  min="0.5"
                  max="5.0"
                  step="0.1"
                  value={cRate}
                  onMouseDown={() => setActiveSlider('crate')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('crate')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualCRateChange(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${cRatePercent}%, #e2e8f0 ${cRatePercent}%, #e2e8f0 100%)`
                  }}
                  className={`w-full h-3 rounded-lg appearance-none cursor-pointer accent-[#0284c7] transition-all ${
                    activeSlider === 'crate' ? 'scale-y-125' : ''
                  }`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  value={cRate}
                  onChange={(e) => handleManualCRateChange(parseFloat(e.target.value) || 0)}
                  className="w-12 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">C</span>
              </div>
            </div>

            {/* ROW 3: Degradation Horizon Target */}
            <div className="h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              {/* 5. Distinctive Infinity Loop Icon */}
              <div className="flex items-center gap-3.5 w-48 sm:w-56 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0284c7] shrink-0 shadow-sm">
                  <InfinityIcon className="w-5 h-5 stroke-[2]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm sm:text-base font-['Space_Grotesk'] font-bold uppercase tracking-wider text-slate-800 leading-tight">
                    Cycle Horizon
                  </span>
                  <span className="text-xs font-mono text-slate-400 font-medium">
                    Target lifespan
                  </span>
                </div>
              </div>

              <div className="flex-1 px-4">
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="10"
                  value={cycleHorizon}
                  onMouseDown={() => setActiveSlider('cycle')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('cycle')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${cyclePercent}%, #e2e8f0 ${cyclePercent}%, #e2e8f0 100%)`
                  }}
                  className={`w-full h-3 rounded-lg appearance-none cursor-pointer accent-[#0284c7] transition-all ${
                    activeSlider === 'cycle' ? 'scale-y-125' : ''
                  }`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  min="100"
                  max="2500"
                  step="10"
                  value={cycleHorizon}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value) || 100)}
                  className="w-14 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">Cycles</span>
              </div>
            </div>

          </div>

          {/* Full-Width Stadium Run Diagnostics Button */}
          <div className="w-full pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-[74px] flex items-center justify-center rounded-full border border-white/60 bg-[#0284c7] text-white shadow-[0_12px_28px_-6px_rgba(2,132,199,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(2,132,199,0.6)] active:scale-[0.99] transition-all duration-300 overflow-hidden cursor-pointer disabled:opacity-50"
            >
              <span 
                className="absolute inset-0 bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#2563eb] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out pointer-events-none" 
              />

              <span className="relative z-10 flex items-center gap-3 text-base font-['Space_Grotesk'] font-bold tracking-[0.16em] uppercase text-white select-none">
                <span>{isLoading ? 'Solving Coupled PDEs...' : 'Run Diagnostics'}</span>
                {!isLoading && <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1.5" />}
              </span>
            </button>
          </div>

        </div>

      </div>

    </form>
  );
};