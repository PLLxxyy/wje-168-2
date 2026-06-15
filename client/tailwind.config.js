/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    colors: {
      primary: '#1e40af',
      accent: '#f59e0b',
    },
    extend: {
      colors: {
        primary: '#1e40af',
        accent: '#f59e0b',
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
