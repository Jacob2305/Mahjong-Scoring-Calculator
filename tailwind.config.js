/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#13261c',
          800: '#1a3a2a',
          700: '#234c37',
          600: '#2d6044',
        },
        ivory: '#f5f0e0',
        gold: '#c9a84c',
        'gold-light': '#e3c876',
        brown: '#6b4f2a',
        'brown-dark': '#3d2c16',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        tile: '0 2px 0 #b9b09a, 0 3px 4px rgba(0,0,0,0.35)',
        'tile-sm': '0 1px 0 #b9b09a, 0 2px 3px rgba(0,0,0,0.3)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(0.6)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        pop: 'pop 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
