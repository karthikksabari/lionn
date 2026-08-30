// src/components/InputPanel.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { PredictRequest, Profile } from '../types';
import { getProfiles } from '../api/predict';
import { useMagnetic } from '../hooks/useMagnetic';
import { Battery3D } from './Battery3D';
import { ArrowRight, ChevronDown, Check, Gauge, Activity, Infinity as InfinityIcon } from 'lucide-react';

export interface InputPanelProps {
  onRunPrediction: (request: PredictRequest) => void;
  isLoading: boolean;
  initialRequest?: PredictRequest;
}

export const InputPanel: React.FC<InputPanelProps> = ({
  onRunPrediction,
  isLoading,
  initialRequest,
}) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    initialRequest?.profile_id ?? initialRequest?.battery_id ?? null
  );
  const [cRate, setCRate] = useState<number>(initialRequest?.c_rate ?? 3.5);
  const [ambientTemp, setAmbientTemp] = useState<number>(initialRequest?.ambient_temp_C ?? 45.0);
  const [cycleHorizon, setCycleHorizon] = useState<number>(initialRequest?.cycle_range?.[1] ?? 1000);
  
  const [isPresetOpen, setIsPresetOpen] = useState<boolean>(false);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRowsContainerRef = useRef<HTMLDivElement>(null);

  const runBtnRef = useMagnetic<HTMLButtonElement>(0.2);

  useEffect(() => {
    if (!inputRowsContainerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.gsap-input-row',
        { opacity: 0, x: 20 },
        {
          opacity: 1,
          x: 0,
          duration: 0.45,
          stagger: 0.08,
          ease: 'power2.out',
        }
      );
    }, inputRowsContainerRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    let isMounted = true;
    getProfiles()
      .then((data) => {
        if (isMounted && data) {
          const profileList: Profile[] = Array.isArray(data) ? data : (data?.profiles ?? []);
          setProfiles(profileList);

          if (!selectedProfileId && profileList.length > 0 && !initialRequest?.profile_id && !initialRequest?.battery_id) {
            const defaultProfile = profileList.find((p) => p.split === 'test') || profileList[0];
            if (defaultProfile) {
              setSelectedProfileId(defaultProfile.profile_id);
              setCRate(defaultProfile.c_rate);
              setAmbientTemp(defaultProfile.temperature);
              if (typeof defaultProfile.max_cycles === 'number') {
                setCycleHorizon(defaultProfile.max_cycles);
              }
            }
          }
        }
      })
      .catch((err) => {
        console.warn('Backend profiles not yet reachable:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProfile = (preset: Profile) => {
    setSelectedProfileId(preset.profile_id);
    setCRate(preset.c_rate);
    setAmbientTemp(preset.temperature);
    if (typeof preset.max_cycles === 'number') {
      setCycleHorizon(preset.max_cycles);
    }
    setIsPresetOpen(false);
  };

  const handleSelectCustom = () => {
    setSelectedProfileId(null);
    setIsPresetOpen(false);
  };

  const handleManualCRateChange = (val: number) => {
    setSelectedProfileId(null);
    setCRate(val);
  };

  const handleManualTempChange = (val: number) => {
    setSelectedProfileId(null);
    setAmbientTemp(val);
  };

  const handleManualCycleChange = (val: number) => {
    setSelectedProfileId(null);
    setCycleHorizon(Math.max(1, Math.round(val)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRunPrediction({
      ...(selectedProfileId ? { profile_id: selectedProfileId, battery_id: selectedProfileId } : {}),
      c_rate: Number(cRate),
      ambient_temp_C: Number(ambientTemp),
      cycle_range: [0, Math.round(Number(cycleHorizon))],
    });
  };

  const chargeLevel = useMemo(() => {
    return Math.min(1.0, Math.max(0.1, cRate / 5.0));
  }, [cRate]);

  const cRatePercent = Math.min(100, Math.max(0, ((cRate - 0.5) / (5.0 - 0.5)) * 100));
  const tempPercent = Math.min(100, Math.max(0, ((ambientTemp - (-20)) / (65 - (-20))) * 100));
  const cyclePercent = Math.min(100, Math.max(0, ((cycleHorizon - 1) / (2000 - 1)) * 100));

  const activeProfile = Array.isArray(profiles) ? profiles.find((p) => p.profile_id === selectedProfileId) : undefined;
  const modeLabel = activeProfile
    ? `Preset: ${activeProfile.label.split('(')[0].trim()}`
    : 'User (Custom)';

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto h-[78vh] max-h-[820px] flex flex-col justify-center">
      
      <div className="w-full h-full flex flex-row items-stretch gap-6">
        
        {/* ================= LEFT COLUMN ================= */}
        <div className="w-[40%] h-full rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/70 p-6 flex flex-col justify-between shadow-[0_16px_40px_rgba(2,132,199,0.06)] overflow-hidden">
          
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
                  activeProfile
                    ? 'bg-[#0284c7] text-white border-[#0284c7] shadow-[0_4px_12px_rgba(2,132,199,0.25)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span>Preset</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPresetOpen ? 'rotate-180' : ''}`} />
              </button>

              {isPresetOpen && (
                <div className="absolute top-11 right-0 z-50 w-80 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200 p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.12)] space-y-1 animate-fadeIn max-h-[340px] overflow-y-auto">
                  {Array.isArray(profiles) && profiles.map((profile) => {
                    const isHeldOut = profile.split === 'test' || profile.split === 'held_out';
                    return (
                      <button
                        key={profile.profile_id}
                        type="button"
                        onClick={() => handleSelectProfile(profile)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-semibold transition-colors flex items-center justify-between gap-2 ${
                          selectedProfileId === profile.profile_id
                            ? 'bg-blue-50 text-[#0284c7]'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="truncate">{profile.label}</span>
                          {isHeldOut && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-[#0284c7] text-[9px] font-mono font-bold tracking-wide uppercase shrink-0">
                              OOD Test
                            </span>
                          )}
                        </div>
                        {selectedProfileId === profile.profile_id && <Check className="w-3.5 h-3.5 shrink-0 text-[#0284c7]" />}
                      </button>
                    );
                  })}

                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={handleSelectCustom}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-['Space_Grotesk'] font-semibold transition-colors flex items-center justify-between ${
                        selectedProfileId === null
                          ? 'bg-blue-50 text-[#0284c7]'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>Custom Scenario (Manual)</span>
                      {selectedProfileId === null && <Check className="w-3.5 h-3.5 shrink-0 text-[#0284c7]" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative my-auto w-full max-w-[390px] mx-auto h-[78%] max-h-[640px] rounded-[32px] bg-gradient-to-b from-white/95 via-slate-50/80 to-slate-100/90 backdrop-blur-2xl border border-white/80 p-2 flex flex-col items-center justify-center shadow-[0_20px_50px_rgba(2,132,199,0.08),0_1px_2px_rgba(255,255,255,0.9)_inset] overflow-hidden">
            <Battery3D
              chargeLevel={chargeLevel}
              temperatureC={ambientTemp}
              cycleHorizon={cycleHorizon}
            />
          </div>

          <div className="pt-2 text-center shrink-0">
            <span className="font-mono text-xs font-semibold text-slate-500 tracking-wider">
              Target: <strong className="text-slate-800">{cycleHorizon} cycles</strong>
            </span>
          </div>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="w-[60%] h-full rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/70 p-6 sm:p-8 flex flex-col justify-between shadow-[0_16px_40px_rgba(2,132,199,0.06)]">
          
          <div ref={inputRowsContainerRef} className="flex-1 flex flex-col justify-center gap-5">
            
            {/* ROW 1: Ambient Temperature */}
            <div className="gsap-input-row h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
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
                  step="0.1"
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

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  step="any"
                  min="-40"
                  max="85"
                  value={ambientTemp}
                  onChange={(e) => handleManualTempChange(parseFloat(e.target.value) || 0)}
                  className="w-16 sm:w-20 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">°C</span>
              </div>
            </div>

            {/* ROW 2: Charge Rate (C-Rate) */}
            <div className="gsap-input-row h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
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
                  step="0.01"
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

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max="10.0"
                  value={cRate}
                  onChange={(e) => handleManualCRateChange(parseFloat(e.target.value) || 0)}
                  className="w-16 sm:w-20 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">C</span>
              </div>
            </div>

            {/* ROW 3: Cycle Horizon Target (Exact Step of 1 from 1 to 2000+) */}
            <div className="gsap-input-row h-[135px] rounded-[36px] bg-white border border-slate-200/90 px-8 py-5 flex items-center justify-between gap-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
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
                  min="1"
                  max="2000"
                  step="1"
                  value={cycleHorizon}
                  onMouseDown={() => setActiveSlider('cycle')}
                  onMouseUp={() => setActiveSlider(null)}
                  onTouchStart={() => setActiveSlider('cycle')}
                  onTouchEnd={() => setActiveSlider(null)}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value, 10))}
                  style={{
                    background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${cyclePercent}%, #e2e8f0 ${cyclePercent}%, #e2e8f0 100%)`
                  }}
                  className={`w-full h-3 rounded-lg appearance-none cursor-pointer accent-[#0284c7] transition-all ${
                    activeSlider === 'cycle' ? 'scale-y-125' : ''
                  }`}
                />
              </div>

              <div className="flex items-center gap-0.5 font-mono text-sm sm:text-base font-bold text-slate-800 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0 shadow-sm">
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={cycleHorizon}
                  onChange={(e) => handleManualCycleChange(parseInt(e.target.value, 10) || 1)}
                  className="w-16 bg-transparent text-right outline-none font-mono font-bold"
                />
                <span className="text-slate-500">Cycles</span>
              </div>
            </div>

          </div>

          {/* Run Diagnostics Button */}
          <div className="w-full pt-4">
            <button
              ref={runBtnRef}
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-[74px] flex items-center justify-center rounded-full border border-white/60 bg-[#0284c7] text-white shadow-[0_12px_28px_-6px_rgba(2,132,199,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(2,132,199,0.6)] active:scale-[0.99] transition-colors duration-300 overflow-hidden cursor-pointer disabled:opacity-50"
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

export default InputPanel;