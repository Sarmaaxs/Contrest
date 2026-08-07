/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050506',
          900: '#0a0a0c',
          850: '#101013',
        },
        drop: {
          400: '#5ecbf5',
          500: '#2fb6e8',
          600: '#1a8fc4',
        },
        violet: {
          brand: '#a855f7',
          deep: '#7c3aed',
          soft: '#c084fc',
        },
        accent: {
          DEFAULT: 'var(--accent-500)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
        },
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(168, 85, 247, 0.4)',
        'glow-sm': '0 0 20px -6px rgba(168, 85, 247, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        drip: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0.9' },
          '70%': { transform: 'translateY(10px) scale(0.85)', opacity: '0.4' },
          '100%': { transform: 'translateY(14px) scale(0.6)', opacity: '0' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.15)' },
        },
        livePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(239, 68, 68, 0)' },
        },
      },
      animation: {
        drip: 'drip 2.4s ease-in-out infinite',
        pulseDot: 'pulseDot 1.1s ease-in-out infinite',
        livePulse: 'livePulse 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};
