/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'accent-primary': '#7C4DFF',
        'accent-secondary': '#4DA3FF',
        'accent-tertiary': '#00D1AC',
        'accent-danger': '#FF3B30',
        'bg-primary': '#06070A',
        'bg-secondary': '#0F1115',
        'bg-tertiary': '#1A1C23',
      },
      borderRadius: {
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
      }
    },
  },
  plugins: [],
}
