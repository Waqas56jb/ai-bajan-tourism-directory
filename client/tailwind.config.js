/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#123044', 700: '#1b4058', 900: '#0b2131' },
        ocean: { DEFAULT: '#13A6A0', 600: '#0f8f8a', 700: '#0b7671' },
        lagoon: '#40C9C1',
        coral: { DEFAULT: '#FF786B', 600: '#e85d50' },
        sand: '#F7F1E7',
        cream: '#FCFAF6',
        palm: '#327C61',
        ink: '#1D2935',
        muted: '#5b6973',
        line: '#E5E8E6',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      maxWidth: { container: '1360px', prose: '68ch' },
      borderRadius: { card: 'var(--radius-card)', xl2: '1.25rem' },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
      },
    },
  },
  plugins: [],
};
