/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        charcoal: {
          950: '#070708',
          900: '#0a0a0a',
          850: '#111113',
          800: '#161619',
          700: '#222227',
          600: '#32323a',
          500: '#484852',
        },
        amber: {
          glow: '#f59e0b',
          dim: '#92400e',
          soft: '#fbbf24',
          accent: '#d97706',
        },
        cyan: {
          electric: '#00f0ff',
          neon: '#22d3ee',
          glow: '#0891b2',
          subtle: '#083344',
        },
        crimson: {
          violation: '#ef4444',
          subtle: '#7f1d1d',
        },
      },
      boxShadow: {
        'amber-glow': '0 0 25px -5px rgba(245, 158, 11, 0.25)',
        'amber-glow-lg': '0 0 40px -10px rgba(245, 158, 11, 0.4)',
        'cyan-glow': '0 0 25px -5px rgba(0, 240, 255, 0.3)',
        'cyan-glow-lg': '0 0 45px -5px rgba(0, 240, 255, 0.45)',
        'card-lift': '0 12px 30px -10px rgba(0, 0, 0, 0.8), 0 0 20px 0 rgba(245, 158, 11, 0.12)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
    },
  },
  plugins: [],
};