import { usePreferences } from '@/context/PreferencesContext';

/**
 * SVG attributes can't read CSS variables, so charts use this JS mirror of the colour tokens
 * in src/index.css. Keep the two in sync when re-theming.
 */
const TOKENS = {
  light: {
    series: [
      'rgb(13,148,142)',
      'rgb(15,42,61)',
      'rgb(233,184,114)',
      'rgb(99,140,214)',
      'rgb(196,98,87)',
      'rgb(150,160,168)',
    ],
    grid: 'rgb(227,231,230)',
    muted: 'rgb(98,110,120)',
    surface: 'rgb(255,255,255)',
    ink: 'rgb(26,36,46)',
    success: 'rgb(22,128,72)',
    warning: 'rgb(180,108,6)',
    danger: 'rgb(196,48,43)',
    info: 'rgb(37,99,199)',
  },
  dark: {
    series: [
      'rgb(45,190,182)',
      'rgb(140,180,205)',
      'rgb(233,184,114)',
      'rgb(110,160,240)',
      'rgb(240,120,108)',
      'rgb(150,163,174)',
    ],
    grid: 'rgb(41,54,66)',
    muted: 'rgb(150,163,174)',
    surface: 'rgb(19,28,37)',
    ink: 'rgb(230,236,240)',
    success: 'rgb(74,196,128)',
    warning: 'rgb(236,168,60)',
    danger: 'rgb(240,104,96)',
    info: 'rgb(110,160,240)',
  },
};

export function useChartColors() {
  const { resolvedTheme } = usePreferences();
  return TOKENS[resolvedTheme] ?? TOKENS.light;
}
