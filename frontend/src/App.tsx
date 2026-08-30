// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { PredictRequest, PredictResponse } from './types';
import { predictBatteryHealth } from './api/predict';
import { InputPanel } from './components/InputPanel';
import { TrajectoryChart } from './components/TrajectoryChart';
import { ScorecardPanel } from './components/ScorecardPanel';
import { RulPanel } from './components/RulPanel';
import { PhysicsLossPanel } from './components/PhysicsLossPanel';
import { useMagnetic } from './hooks/useMagnetic';
import { RotateCcw, AlertTriangle, Loader2, Zap, ArrowLeft } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

type ScreenState = 'landing' | 'input' | 'results';

// 24 Scattered Background Line-Art Icons & Physics Equations
const ScatteredBackgroundElements: React.FC<{ theme?: 'light' | 'dark' }> = ({ theme = 'light' }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? 'text-cyan-400 opacity-[0.14]' : 'text-slate-500/35';

  return (
    <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden ${textColor}`}>
      {/* 1. Cylindrical Battery Cell (Preserved Position) */}
      <svg className="absolute top-[20%] left-[20%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <line x1="20" y1="10" x2="20" y2="14" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="7" y1="10" x2="7" y2="14" />
      </svg>

      {/* 2. Arrhenius Equation (Preserved Position) */}
      <div className="absolute top-[6%] left-[42%] font-mono text-xs tracking-widest font-semibold">
        k = A·e^(-Ea/RT)
      </div>

      {/* 3. Neural Network Topology (Top-Mid) */}
      <svg className="absolute top-[14%] left-[38%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="2" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="19" r="2" />
        <circle cx="19" cy="12" r="2" />
        <path d="M7 12h3M14 12h3M6.5 10.5l4-4M6.5 13.5l4 4M13.5 6.5l4 4M13.5 17.5l4-4" strokeLinecap="round" />
      </svg>

      {/* 4. Voltage Delta Badge */}
      <div className="absolute top-[5%] right-[28%] font-mono text-xs tracking-widest font-bold">
        &Delta;V = I·R_int
      </div>

      {/* 5. EV Energy Vector Tag */}
      <div className="absolute top-[4%] right-[10%] font-space font-extrabold text-sm tracking-widest">
        EV &bull; SOH
      </div>

      {/* 6. Diagnostic Gauge Clock (Top Right) */}
      <svg className="absolute top-[7%] right-[4%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" />
      </svg>

      {/* 7. Fast Voltage Spark Impulse (Upper-Left Margin) */}
      <svg className="absolute top-[26%] left-[3%] w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>

      {/* 8. Lithium-Ion Orbital (Upper Right-Mid) */}
      <svg className="absolute top-[20%] right-[16%] w-9 h-9" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(30 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-30 12 12)" />
      </svg>

      {/* 9. Lightbulb / Physics Ideation (Mid-Right) */}
      <svg className="absolute top-[32%] right-[5%] w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <path d="M12 2a6 6 0 0 0-6 6c0 2.22 1.21 4.16 3 5.2V16a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2.8c1.79-1.04 3-2.98 3-5.2a6 6 0 0 0-6-6z" />
      </svg>

      {/* 10. SEI Micro-Lattice (Mid Left) */}
      <svg className="absolute top-[42%] left-[4%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* 11. Monotonic Degradation Constraint (Mid Left-Center) */}
      <div className="absolute top-[40%] left-[20%] font-mono text-xs tracking-widest font-bold">
        ∂Q / ∂t ≤ 0
      </div>

      {/* 12. Tri-Node Gutter Connector (Center) */}
      <svg className="absolute top-[48%] left-[49%] -translate-x-1/2 w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="19" cy="18" r="2" />
        <path d="M7 12l10-5M7 12l10 5" strokeLinecap="round" />
      </svg>

      {/* 13. Dual-Terminal Stacked Cell (Mid Right-Center) */}
      <svg className="absolute top-[46%] right-[22%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="6" rx="1.5" />
        <rect x="3" y="14" width="18" height="6" rx="1.5" />
        <line x1="8" y1="7" x2="10" y2="7" strokeLinecap="round" />
      </svg>

      {/* 14. C-Rate Flow Notation (Mid Right Margin) */}
      <div className="absolute top-[54%] right-[3%] font-mono text-[11px] tracking-widest font-semibold">
        [ C-Rate: 3.5C &bull; 45°C ]
      </div>

      {/* 15. Cloud / Ambient Operating Envelope (Lower Mid-Left) */}
      <svg className="absolute top-[60%] left-[6%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>

      {/* 16. Arrhenius Thermodynamic Factor (Lower Mid-Center) */}
      <div className="absolute top-[64%] left-[34%] font-mono text-xs tracking-widest font-semibold">
        D_eff = D_0 · exp(-E_a / RT)
      </div>

      {/* 17. Kinetic Temperature Thermometer (Lower Mid-Right) */}
      <svg className="absolute top-[66%] right-[8%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
      </svg>

      {/* 18. Physics Loss Lagrangian Formulation (Bottom Mid-Right) */}
      <div className="absolute bottom-[24%] right-[16%] font-mono text-xs tracking-widest font-bold">
        ℒ_total = ℒ_data + λ_p·ℒ_physics
      </div>

      {/* 19. Impedance Capacitor Node (Bottom Left) */}
      <svg className="absolute bottom-[14%] left-[4%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <line x1="2" y1="12" x2="9" y2="12" />
        <line x1="9" y1="6" x2="9" y2="18" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="15" y1="6" x2="15" y2="18" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="15" y1="12" x2="22" y2="12" />
      </svg>

      {/* 20. Monotonic Derivative (Bottom Left-Center) */}
      <div className="absolute bottom-[10%] left-[16%] font-mono text-xs tracking-widest font-bold">
        ∂Q / ∂t
      </div>

      {/* 21. Secondary Spark Impulse (Bottom Center) */}
      <svg className="absolute bottom-[8%] left-[46%] w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>

      {/* 22. Butler-Volmer SEI Kinetics Notation (Bottom Right-Center) */}
      <div className="absolute bottom-[8%] right-[22%] font-mono text-xs tracking-widest font-semibold">
        j_sei = -F · k_sei · c_ec · exp(-αFη/RT)
      </div>

      {/* 23. Circular SOH Waveform (Bottom Right Margin) */}
      <svg className="absolute bottom-[6%] right-[5%] w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h2l2-4 3 8 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* 24. Pouch Battery Cell (Bottom Far-Left) */}
      <svg className="absolute bottom-[4%] left-[28%] w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.35" viewBox="0 0 24 24">
        <rect x="2" y="7" width="16" height="10" rx="2" />
        <line x1="20" y1="10" x2="20" y2="14" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenState>('landing');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [lastRequest, setLastRequest] = useState<PredictRequest>({
    c_rate: 3.5,
    ambient_temp_C: 45.0,
    cycle_range: [0, 1000],
  });

  const [predictionData, setPredictionData] = useState<PredictResponse | null>(null);

  // Magnetic Button Refs
  const landingBtnRef = useMagnetic<HTMLButtonElement>(0.2);

  // Results Page Container for GSAP Scope
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const lionParallaxRef = useRef<HTMLDivElement>(null);
  const backgroundParallaxRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Lenis Smooth Scrolling & Bind to GSAP ScrollTrigger
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const updateLenis = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateLenis);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateLenis);
      lenis.destroy();
    };
  }, []);

  // 2. Results Screen: Scroll-Triggered Staggered Reveals + Parallax
  useEffect(() => {
    if (screen !== 'results' || !predictionData) return;

    const ctx = gsap.context(() => {
      // 4. Background Parallax (Lion & Scattered Icons at 50-70% speed)
      if (lionParallaxRef.current) {
        gsap.to(lionParallaxRef.current, {
          yPercent: 30,
          ease: 'none',
          scrollTrigger: {
            trigger: resultsContainerRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.8,
          },
        });
      }

      if (backgroundParallaxRef.current) {
        gsap.to(backgroundParallaxRef.current, {
          yPercent: 20,
          ease: 'none',
          scrollTrigger: {
            trigger: resultsContainerRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.0,
          },
        });
      }

      // 2. Staggered Card Reveals on Scroll
      const revealCards = gsap.utils.toArray<HTMLElement>('.gsap-reveal-card');
      revealCards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: card,
              start: 'top 88%',
              toggleActions: 'play none none none',
            },
          }
        );
      });

      // Side-by-side card stagger (Scorecard / RUL)
      gsap.fromTo(
        '.gsap-side-card',
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.12,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.gsap-side-grid',
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        }
      );

      ScrollTrigger.refresh();
    }, resultsContainerRef);

    return () => ctx.revert();
  }, [screen, predictionData]);

  const handleRunPrediction = async (request: PredictRequest) => {
    setLastRequest(request);
    setIsLoading(true);
    setError(null);

    try {
      const response = await predictBatteryHealth(request);
      setPredictionData(response);
      setScreen('results');
    } catch (err) {
      console.error('Prediction failed:', err);
      setError('Failed to compute battery degradation profile. Please check input boundaries.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnToInput = () => {
    setError(null);
    setScreen('input');
  };

  const ratedCapacity = predictionData?.capacity_pinn?.[0] ?? 1.1;
  const finalPredictedCapacity = predictionData?.capacity_pinn
    ? predictionData.capacity_pinn[predictionData.capacity_pinn.length - 1]
    : 0.88;
  const currentSohPercent = Math.min(
    100,
    Math.max(0, (finalPredictedCapacity / ratedCapacity) * 100)
  );
  const isSafeOperating = currentSohPercent >= 80.0;

  const pinnRulCycles =
    predictionData?.rul?.rul_pinn ??
    (predictionData?.rul as any)?.pinn_cycles ??
    920;

  const isCustomScenario = !lastRequest.profile_id && (!lastRequest.battery_id || lastRequest.battery_id === 'custom_user_scenario');
  const regimeDisplayName = isCustomScenario
    ? 'Custom User Scenario'
    : (lastRequest.profile_id ?? lastRequest.battery_id ?? 'Selected Scenario').replace(/_/g, ' ');

  return (
    <div className="min-h-screen font-sans selection:bg-blue-500/30 selection:text-blue-900 bg-white text-slate-800">
      <main className="w-full relative flex flex-col justify-center">
        
        {/* ================= 1. LANDING SCREEN ================= */}
        {screen === 'landing' && (
          <div 
            className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-10 select-none overflow-hidden"
            style={{
              background: 'radial-gradient(ellipse 80% 70% at 100% 100%, rgba(2, 132, 199, 0.22) 0%, rgba(59, 130, 246, 0.08) 45%, rgba(248, 250, 252, 0) 80%), radial-gradient(ellipse 60% 50% at 0% 0%, rgba(2, 132, 199, 0.06) 0%, rgba(248, 250, 252, 0) 70%), #f8fafc'
            }}
          >
            <div 
              className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay z-[1]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
              }}
            />

            <ScatteredBackgroundElements theme="light" />

            <div className="absolute top-[18%] bottom-10 right-[-16%] sm:right-[-13%] lg:right-[10%] w-[95%] sm:w-[85%] lg:w-[75%] pointer-events-none overflow-visible z-0 flex items-center justify-end">
              <img
                src="/lion-profile.png"
                alt="Lion Background Profile"
                className="h-[154vh] sm:h-[170vh] lg:h-[174vh] max-h-[1220px] w-auto object-contain object-right opacity-[0.24] mix-blend-multiply pointer-events-none transform translate-y-4"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-2xl w-full mx-auto space-y-7 sm:space-y-8">
              <h1 className="text-6xl sm:text-7xl lg:text-[86px] font-space font-extrabold tracking-[0.08em] leading-none select-none drop-shadow-sm">
                <span className="text-[#07132b]">L</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0284c7] via-[#1d4ed8] to-[#2563eb]">
                  ION
                </span>
                <span className="text-[#07132b]">N</span>
              </h1>

              <div className="relative w-full">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-400/20 via-sky-300/25 to-blue-500/15 rounded-[48px] blur-3xl pointer-events-none -z-10" />

                <div className="w-full rounded-[42px] p-2.5 sm:p-3.5 bg-[#e0ecf8]/60 backdrop-blur-3xl border border-white/80 shadow-[0_24px_50px_-15px_rgba(2,132,199,0.14),0_1px_2px_rgba(255,255,255,0.9)_inset] transition-all">
                  <div className="w-full rounded-[34px] bg-white/90 backdrop-blur-2xl border border-white/70 px-8 sm:px-14 py-10 sm:py-12 flex flex-col items-center text-center shadow-[0_8px_20px_rgba(15,23,42,0.03)] space-y-7">
                    <div className="space-y-2.5 max-w-lg mx-auto">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-mono font-semibold tracking-[0.24em] text-slate-400 uppercase">
                          SYSTEM READY &bull; SOH DIAGNOSTICS
                        </span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-space font-bold text-[#09152e] tracking-[0.06em] uppercase">
                        Battery Intelligence
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 font-sans font-light leading-relaxed tracking-normal">
                        AI-powered insights for smarter battery health.
                      </p>
                    </div>

                    <div className="w-full flex items-center justify-center pt-1">
                      {/* 3. Magnetic Button Hover */}
                      <button
                        ref={landingBtnRef}
                        onClick={() => setScreen('input')}
                        className="group relative w-full max-w-md h-16 sm:h-[70px] flex items-center justify-center rounded-2xl border-2 border-slate-300/80 bg-slate-50/90 hover:border-[#0284c7] shadow-[0_10px_30px_-5px_rgba(2,132,199,0.25)] hover:shadow-[0_16px_40px_-5px_rgba(2,132,199,0.45)] active:scale-[0.99] transition-colors duration-300 overflow-visible cursor-pointer"
                      >
                        <span className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2 w-2.5 sm:w-3 h-7 sm:h-8 rounded-r-md bg-slate-300 border-2 border-l-0 border-slate-300 group-hover:bg-[#0284c7] group-hover:border-[#0284c7] transition-colors duration-300 pointer-events-none" />

                        <div className="absolute inset-0 rounded-[13px] overflow-hidden pointer-events-none">
                          <div className="w-full h-full bg-gradient-to-r from-[#0284c7] via-[#0369a1] to-[#1d4ed8] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                        </div>

                        <span className="relative z-10 text-xs sm:text-sm font-space font-bold tracking-[0.14em] uppercase text-slate-700 group-hover:text-white transition-colors duration-300 select-none">
                          Launch Diagnostics
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. SCENARIO INPUT SCREEN ================= */}
        {screen === 'input' && (
          <div 
            className="relative min-h-screen h-screen w-full flex flex-col justify-center px-6 lg:px-12 py-6 select-none overflow-hidden"
            style={{
              background: 'linear-gradient(to top, #0284c7 0%, rgba(2, 132, 199, 0.75) 15%, rgba(2, 132, 199, 0.35) 35%, rgba(255, 255, 255, 0.95) 65%, #ffffff 100%)'
            }}
          >
            <ScatteredBackgroundElements theme="light" />

            {/* Preserved Top-Left Corner Lion Art */}
            <div className="absolute top-[-15px] left-[-15px] pointer-events-none z-0 flex items-start">
              <img
                src="/lion-profile.png"
                alt="Corner Lion Art"
                className="w-56 sm:w-64 h-auto opacity-[0.24] mix-blend-multiply rotate-[-6deg]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>

            {/* Preserved "LIONN" Wordmark */}
            <div className="absolute top-11 left-60 z-14 flex items-center">
              <div 
                onClick={() => setScreen('landing')} 
                className="cursor-pointer transition-transform hover:scale-[1.03]"
              >
                <h2 className="text-5xl sm:text-6xl font-space font-extrabold tracking-[0.08em] leading-none select-none drop-shadow-sm">
                  <span className="text-[#07132b]">L</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0284c7] via-[#1d4ed8] to-[#2563eb]">
                    ION
                  </span>
                  <span className="text-[#07132b]">N</span>
                </h2>
              </div>
            </div>

            {/* Preserved Reverse Arrow Button */}
            <button
              onClick={() => setScreen('landing')}
              title="Return to Landing Page"
              className="absolute top-4 right-6 sm:top-4 sm:right-6 z-30 p-2 text-slate-400 hover:text-slate-900 transition-all duration-300 transform hover:scale-125 active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.75]" />
            </button>

            {!isLoading && (
              <div className="relative z-10 w-full flex items-center justify-center pt-10">
                <InputPanel 
                  onRunPrediction={handleRunPrediction} 
                  isLoading={isLoading} 
                  initialRequest={lastRequest}
                />
              </div>
            )}

            {isLoading && (
              <div className="relative z-10 rounded-3xl bg-white/95 backdrop-blur-2xl border-2 border-slate-200/80 p-12 text-center max-w-lg mx-auto space-y-5 my-auto shadow-[0_20px_50px_rgba(2,132,199,0.16)]">
                <div className="relative flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-[#0284c7] animate-spin" />
                  <Zap className="w-5 h-5 text-amber-500 absolute" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-space text-lg font-bold text-slate-900">Solving Coupled Differential PDEs</h3>
                  <p className="text-xs font-mono text-slate-500">
                    Evaluating neural loss ℒ_total = ℒ_data + λ_p ℒ_physics...
                  </p>
                </div>
                <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-r from-blue-400 to-[#0284c7] animate-pulse" />
                </div>
              </div>
            )}

            {error && (
              <div className="relative z-10 max-w-xl mx-auto p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. DEDICATED RESULTS VIEW ================= */}
        {screen === 'results' && predictionData && (
          <div ref={resultsContainerRef} className="relative min-h-screen w-full overflow-x-hidden">
            
            {/* LAYER A: Fixed Background Layer */}
            <div 
              className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
              style={{
                background: 'linear-gradient(to top, #0284c7 0%, rgba(2, 132, 199, 0.75) 15%, rgba(2, 132, 199, 0.35) 35%, rgba(255, 255, 255, 0.95) 65%, #ffffff 100%)'
              }}
            >
              {/* 4. Parallax Background Lion Art */}
              <div ref={lionParallaxRef} className="absolute top-[-15px] left-[-15px]">
                <img
                  src="/lion-profile.png"
                  alt="Corner Lion Art"
                  className="w-56 sm:w-64 h-auto opacity-[0.24] mix-blend-multiply rotate-[-6deg]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>

              {/* 4. Parallax Scattered Background Elements */}
              <div ref={backgroundParallaxRef} className="absolute inset-0">
                <ScatteredBackgroundElements theme="light" />
              </div>
            </div>

            {/* LAYER B: Scrollable Content Layer */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-14 py-10 space-y-10 pb-20">
              
              {/* Top Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
                <button
                  onClick={handleReturnToInput}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0284c7]/15 hover:bg-[#0284c7]/25 text-xs sm:text-sm font-space font-bold text-slate-800 border border-[#0284c7]/30 transition-all cursor-pointer shadow-[0_4px_12px_rgba(2,132,199,0.08)] w-fit"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="tracking-[0.06em] uppercase">Back to Input</span>
                </button>

                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <span className="px-3.5 py-2 rounded-2xl bg-[#0284c7]/15 backdrop-blur-md border border-[#0284c7]/25 text-slate-800 shadow-[0_4px_12px_rgba(2,132,199,0.06)]">
                    <span className="tracking-[0.1em] text-slate-500 uppercase">Regime:</span>{' '}
                    <strong className="text-slate-900">{regimeDisplayName}</strong>
                  </span>
                  <span className="px-3.5 py-2 rounded-2xl bg-[#0284c7]/15 backdrop-blur-md border border-[#0284c7]/25 text-slate-800 shadow-[0_4px_12px_rgba(2,132,199,0.06)]">
                    <span className="tracking-[0.1em] text-slate-500 uppercase">C-Rate:</span>{' '}
                    <strong className="text-[#0284c7]">{lastRequest.c_rate.toFixed(1)}C</strong>
                  </span>
                  <span className="px-3.5 py-2 rounded-2xl bg-[#0284c7]/15 backdrop-blur-md border border-[#0284c7]/25 text-slate-800 shadow-[0_4px_12px_rgba(2,132,199,0.06)]">
                    <span className="tracking-[0.1em] text-slate-500 uppercase">Temp:</span>{' '}
                    <strong className="text-[#0284c7]">{lastRequest.ambient_temp_C.toFixed(0)}°C</strong>
                  </span>
                  <span className="px-3.5 py-2 rounded-2xl bg-[#0284c7]/15 backdrop-blur-md border border-[#0284c7]/25 text-slate-800 shadow-[0_4px_12px_rgba(2,132,199,0.06)]">
                    <span className="tracking-[0.1em] text-slate-500 uppercase">Horizon:</span>{' '}
                    <strong className="text-[#0284c7]">{lastRequest.cycle_range[1]} Cycles</strong>
                  </span>
                </div>
              </div>

              {/* 2. Scroll-Triggered Diagnostic Summary */}
              <div className="gsap-reveal-card rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/80 p-8 sm:p-10 shadow-[0_24px_50px_rgba(2,132,199,0.08)] space-y-7">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                  
                  {/* Card 1: Predicted SOH */}
                  <div className="py-8 px-7 rounded-[24px] bg-white/75 backdrop-blur-xl border border-white/90 shadow-[0_6px_20px_rgba(2,132,199,0.04)] flex flex-col justify-between space-y-4">
                    <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500">
                      PREDICTED STATE OF HEALTH
                    </span>
                    <div className="text-6xl sm:text-7xl font-space font-extrabold tracking-tight text-[#0284c7] leading-none">
                      {currentSohPercent.toFixed(1)}%
                    </div>
                  </div>

                  {/* Card 2: Predicted Lifespan (RUL) */}
                  <div className="py-8 px-7 rounded-[24px] bg-white/75 backdrop-blur-xl border border-white/90 shadow-[0_6px_20px_rgba(2,132,199,0.04)] flex flex-col justify-between space-y-4">
                    <span className="text-xs font-mono font-bold uppercase tracking-[0.14em] text-slate-500">
                      PREDICTED LIFESPAN (RUL)
                    </span>
                    <div className="text-5xl sm:text-6xl font-space font-extrabold tracking-tight text-slate-900 leading-none">
                      {pinnRulCycles}{' '}
                      <span className="text-2xl sm:text-3xl font-mono font-bold text-slate-500">Cycles</span>
                    </div>
                  </div>

                  {/* Card 3: Safety Verdict */}
                  <div className={`py-8 px-7 rounded-[24px] backdrop-blur-xl border shadow-[0_6px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-4 ${
                    isSafeOperating
                      ? 'bg-emerald-50/60 border-emerald-200/80'
                      : 'bg-amber-50/60 border-amber-200/80'
                  }`}>
                    <span className={`text-xs font-mono font-bold uppercase tracking-[0.14em] ${
                      isSafeOperating ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      SAFETY VERDICT
                    </span>
                    <div className={`text-2xl sm:text-3xl font-space font-extrabold tracking-wide leading-tight ${
                      isSafeOperating ? 'text-emerald-800' : 'text-amber-800'
                    }`}>
                      {isSafeOperating ? 'Within Safe Operating Envelope' : 'Approaching End-of-Life Threshold'}
                    </div>
                  </div>

                </div>

                <p className="text-xs sm:text-sm text-slate-600 font-sans leading-relaxed pt-3 border-t border-slate-200/60">
                  {isCustomScenario ? (
                    <>
                      Prediction for <strong className="text-slate-900">custom scenario</strong> at{' '}
                      <strong className="text-slate-900">{lastRequest.c_rate.toFixed(1)}C</strong> /{' '}
                      <strong className="text-slate-900">{lastRequest.ambient_temp_C.toFixed(0)}°C</strong> over{' '}
                      <strong className="text-slate-900">{lastRequest.cycle_range[1]} cycles</strong>, compared against a physics-simulated reference (no recorded data exists for this exact configuration).
                    </>
                  ) : (
                    <>
                      Prediction for <strong className="text-slate-900">{regimeDisplayName}</strong> at{' '}
                      <strong className="text-slate-900">{lastRequest.c_rate.toFixed(1)}C</strong> /{' '}
                      <strong className="text-slate-900">{lastRequest.ambient_temp_C.toFixed(0)}°C</strong> over{' '}
                      <strong className="text-slate-900">{lastRequest.cycle_range[1]} cycles</strong>, validated against recorded ground truth and baseline MLP below.
                    </>
                  )}
                </p>

              </div>

              {/* 2. Scroll-Triggered Trajectory Degradation Section */}
              <div className="gsap-reveal-card rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/80 p-6 sm:p-9 lg:p-10 shadow-[0_20px_50px_rgba(2,132,199,0.06)]">
                <TrajectoryChart
                  cycles={predictionData.cycles}
                  groundTruth={predictionData.ground_truth}
                  groundTruthType={predictionData.ground_truth_type}
                  capacityBaselineMlp={predictionData.capacity_baseline_mlp}
                  capacityPinn={predictionData.capacity_pinn}
                />
              </div>

              {/* 2. Side-by-Side Staggered Cards (Scorecard & RUL) */}
              <div className="gsap-side-grid grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
                <div className="gsap-side-card rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/80 p-6 sm:p-8 shadow-[0_20px_50px_rgba(2,132,199,0.06)] flex flex-col justify-between">
                  <ScorecardPanel
  metrics={predictionData.metrics}
  cycles={predictionData.cycles}
  groundTruth={predictionData.ground_truth}
  capacityBaselineMlp={predictionData.capacity_baseline_mlp}
  capacityPinn={predictionData.capacity_pinn}
/>
                </div>

                <div className="gsap-side-card rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/80 p-6 sm:p-8 shadow-[0_20px_50px_rgba(2,132,199,0.06)] flex flex-col justify-between">
                  <RulPanel rul={predictionData.rul} />
                </div>
              </div>

              {/* 2. Scroll-Triggered Physics Loss Trace Card */}
              <div className="gsap-reveal-card rounded-[32px] bg-slate-900/[0.04] backdrop-blur-[24px] border border-white/80 p-6 sm:p-8 lg:p-10 shadow-[0_20px_50px_rgba(2,132,199,0.06)]">
                <PhysicsLossPanel
                  physicsLossTrace={predictionData.physics_loss_trace}
                />
              </div>

              {/* Scenario Reset Action Button */}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={handleReturnToInput}
                  className="px-8 py-3.5 rounded-full bg-slate-900 hover:bg-black text-sm font-space font-bold tracking-[0.14em] uppercase text-white transition-all flex items-center gap-2.5 shadow-lg cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Configure New Scenario</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;