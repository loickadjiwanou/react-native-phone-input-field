import type { PhoneFieldTheme } from './types';

/**
 * Light theme. Text colors reach WCAG AA (≥ 4.5:1) on `background` and
 * `surface`; the idle border reaches 3:1 (non-text contrast).
 */
export const defaultTheme: PhoneFieldTheme = {
  colors: {
    primary: '#2563EB',
    border: '#8A93A3',
    error: '#C81E1E',
    success: '#15803D',
    text: '#111827',
    textSecondary: '#4B5563',
    placeholder: '#646B77',
    background: '#FFFFFF',
    surface: '#F3F4F6',
    disabled: '#9CA3AF',
    overlay: '#111827',
    highlight: '#EFF6FF',
    separator: '#D1D5DB',
  },
  radius: { field: 12, modal: 20, item: 10, search: 10 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  fontFamily: { regular: undefined, medium: undefined, bold: undefined },
  fontSizes: {
    label: 14,
    helper: 13,
    callingCode: 16,
    modalTitle: 18,
    item: 16,
    sectionHeader: 13,
    search: 16,
  },
  borderWidth: { normal: 1, focus: 2 },
  sizes: {
    sm: { height: 40, fontSize: 14, flagSize: 18, paddingHorizontal: 10 },
    md: { height: 52, fontSize: 16, flagSize: 22, paddingHorizontal: 12 },
    lg: { height: 60, fontSize: 18, flagSize: 26, paddingHorizontal: 14 },
  },
  countryItemHeight: 56,
  animationDuration: 150,
};
