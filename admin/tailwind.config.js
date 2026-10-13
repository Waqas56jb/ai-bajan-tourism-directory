/** @type {import('tailwindcss').Config} */
// Colours reference CSS variables (see src/index.css) so the whole dashboard can be re-themed
// from one place. The `<alpha-value>` form keeps opacity modifiers like bg-accent/10 working.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: token('surface'),
        subtle: token('subtle'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        navy: { DEFAULT: token('navy'), 600: token('navy-600'), 800: token('navy-800') },
        accent: { DEFAULT: token('accent'), 600: token('accent-600'), 50: token('accent-50') },
        sand: { DEFAULT: token('sand'), 600: token('sand-600') },
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '14px' },
      boxShadow: {
        card: '0 1px 2px rgb(15 30 45 / 0.04), 0 1px 3px rgb(15 30 45 / 0.04)',
        pop: '0 12px 32px -8px rgb(15 30 45 / 0.18), 0 2px 6px rgb(15 30 45 / 0.06)',
      },
      fontSize: { '2xs': ['0.6875rem', '1rem'] },
    },
  },
  plugins: [],
};
