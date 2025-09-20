/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#43cea2',
          dark: '#185a9d',
          light: '#60e6c2',
        },
        accent: '#f093fb',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'Segoe UI', 'Arial', 'sans-serif'],
      },
      backdropBlur: {
        '20': '20px',
        '25': '25px',
      },
    },
  },
  plugins: [],
}