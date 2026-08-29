import React from 'react';

interface LionnWordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showSubtext?: boolean;
}

export const LionnWordmark: React.FC<LionnWordmarkProps> = ({
  className = '',
  size = 'md',
  showSubtext = false,
}) => {
  const sizeClasses = {
    sm: 'h-7',
    md: 'h-10',
    lg: 'h-14',
    hero: 'h-20 md:h-24',
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div className={`relative flex items-center justify-center ${sizeClasses[size]}`}>
        <svg
          viewBox="0 0 540 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-auto drop-shadow-amber-glow"
        >
          <defs>
            {/* Amber Charge Gradient */}
            <linearGradient id="amberGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="30%" stopColor="#f59e0b" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>

            {/* Cyan Electric Gradient */}
            <linearGradient id="cyanPinnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="50%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            {/* Glow Filter */}
            <filter id="pinnGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Battery Anode / Charge Icon */}
          <g transform="translate(10, 18)">
            {/* Battery Body Outline */}
            <rect
              x="6"
              y="12"
              width="56"
              height="68"
              rx="10"
              stroke="url(#amberGoldGrad)"
              strokeWidth="5"
              fill="#141417"
            />
            {/* Battery Terminal Pin */}
            <path
              d="M26 6 H42 V12 H26 Z"
              fill="#f59e0b"
            />
            {/* Dynamic Energy Waveform inside cell */}
            <path
              d="M18 58 L28 34 L40 50 L50 28"
              stroke="url(#cyanPinnGrad)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#pinnGlow)"
            />
            {/* Monotonic physics trajectory vector indicator */}
            <circle cx="50" cy="28" r="4.5" fill="#00f0ff" />
          </g>

          {/* Typography: LIONN in Space Grotesk Styling */}
          <g transform="translate(90, 84)">
            <text
              fontFamily="Space Grotesk, sans-serif"
              fontSize="76"
              fontWeight="800"
              letterSpacing="7"
              fill="#ffffff"
            >
              LI
            </text>
            <text
              x="120"
              y="0"
              fontFamily="Space Grotesk, sans-serif"
              fontSize="76"
              fontWeight="800"
              letterSpacing="7"
              fill="url(#amberGoldGrad)"
            >
              O
            </text>
            <text
              x="205"
              y="0"
              fontFamily="Space Grotesk, sans-serif"
              fontSize="76"
              fontWeight="800"
              letterSpacing="7"
              fill="#ffffff"
            >
              NN
            </text>
          </g>

          {/* Subscript Tag: Physics-Informed Battery Intelligence */}
          <text
            x="395"
            y="36"
            fontFamily="JetBrains Mono, monospace"
            fontSize="14"
            fontWeight="600"
            letterSpacing="3"
            fill="#00f0ff"
            filter="url(#pinnGlow)"
          >
            PINN.v2
          </text>
        </svg>
      </div>

      {showSubtext && (
        <p className="mt-2 text-xs md:text-sm font-mono tracking-widest text-slate-400 uppercase text-center">
          Physics-Informed Neural Network • Battery Degradation Diagnostics
        </p>
      )}
    </div>
  );
};