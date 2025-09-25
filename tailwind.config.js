/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        beige: '#EDECE5',
        navy: '#333D56',
        darkRed: '#A4384C',
        lightRed: '#E9C9D1',
        mint: '#5EA89B',
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
        sans: [
          'var(--font-public-sans)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
