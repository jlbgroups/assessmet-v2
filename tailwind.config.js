/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#c95b2f',
        dark: '#10222d',
        success: '#176b68',
        warning: '#d5a24c',
        danger: '#DC2626',
        background: '#f4efe6',
        surface: '#FFFFFF',
        border: '#e6dfd3',
        brand: {
          ink: '#10222d',
          clay: '#c95b2f',
          sand: '#f4efe6',
          teal: '#176b68',
          gold: '#d5a24c',
        },
        indigo: {
          50: '#fff6ee',
          100: '#f7ebd9',
          200: '#f0d5bc',
          300: '#e2b490',
          400: '#d59368',
          500: '#c95b2f',
          600: '#c95b2f',
          650: '#b24c25',
          700: '#9a4b2c',
          800: '#10222d',
          900: '#10222d',
        },
      },
      borderRadius: {
        'card': '24px',
        'input': '12px',
        'btn': '12px',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'General Sans', 'sans-serif'],
        display: ['Space Grotesk', 'Outfit', 'Inter', 'sans-serif'],
      },
      spacing: {
        'content': '24px',
      },
    },
  },
  plugins: [],
}
