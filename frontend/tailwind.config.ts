import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'classhi-bg': '#FAFAF7',
        'classhi-green': '#00A86B',
        'classhi-coral': '#E4572E',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'price-flash-green': {
          '0%':   { backgroundColor: '#00A86B', color: '#ffffff' },
          '100%': { backgroundColor: 'transparent', color: 'inherit' },
        },
        'price-flash-coral': {
          '0%':   { backgroundColor: '#E4572E', color: '#ffffff' },
          '100%': { backgroundColor: 'transparent', color: 'inherit' },
        },
      },
      animation: {
        'flash-green': 'price-flash-green 400ms ease-out forwards',
        'flash-coral': 'price-flash-coral 400ms ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
