/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          darkest: '#09080E',
          base: '#0F0D17',
          card: '#161322',
          border: '#272238',
          muted: '#7E7694',
          accent: '#6366F1', // Indigo
          neon: '#EC4899',   // Pink / Fuchsia
          rose: '#F43F5E',   // Romantic Rose
          sunset: '#FB7185', // Sunset Coral
          candle: '#F59E0B', // Candlelight Amber
          gold: '#F59E0B',   // Warm Amber
          emerald: '#10B981',// Green
          violet: '#8B5CF6'  // Deep Violet
        }
      },
      boxShadow: {
        'ambient-rose': '0 0 70px -15px rgba(244, 63, 94, 0.35)',
        'ambient-candle': '0 0 70px -15px rgba(245, 158, 11, 0.35)',
        'ambient-violet': '0 0 70px -15px rgba(139, 92, 246, 0.35)',
        'glass-card': '0 8px 32px 0 rgba(0, 0, 0, 0.45)',
      },
      animation: {
        'float-up': 'floatUp 2.4s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-glow': 'pulseGlow 2s infinite ease-in-out',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(20px) scale(0.6)', opacity: '0' },
          '15%': { transform: 'translateY(0px) scale(1.2)', opacity: '1' },
          '80%': { opacity: '0.9' },
          '100%': { transform: 'translateY(-140px) scale(1.0)', opacity: '0' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)' },
          '50%': { boxShadow: '0 0 30px rgba(244, 63, 94, 0.8)' }
        },
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' }
        }
      }
    },
  },
  plugins: [],
}
