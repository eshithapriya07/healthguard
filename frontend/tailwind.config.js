/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9edff',
          200: '#bce0ff',
          300: '#8ecdff',
          400: '#59b0ff',
          500: '#338fff',
          600: '#1b6ff5',
          700: '#1458e1',
          800: '#1747b6',
          900: '#193f8f',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
