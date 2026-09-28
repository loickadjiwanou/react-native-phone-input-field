import { defaultTheme } from './defaultTheme';
import type { PhoneFieldTheme } from './types';

/** Dark theme, same contrast guarantees as `defaultTheme`. */
export const darkTheme: PhoneFieldTheme = {
  ...defaultTheme,
  colors: {
    primary: '#60A5FA',
    border: '#6B7280',
    error: '#F87171',
    success: '#4ADE80',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    placeholder: '#9CA3AF',
    background: '#111827',
    surface: '#1F2937',
    disabled: '#4B5563',
    overlay: '#000000',
    highlight: '#1E3A5F',
    separator: '#374151',
  },
};
