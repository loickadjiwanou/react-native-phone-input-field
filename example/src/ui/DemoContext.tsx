import { createContext, useContext } from 'react';

export type Locale = 'fr' | 'en';

export interface DemoSettings {
  dark: boolean;
  locale: Locale;
  rtl: boolean;
}

export const DemoContext = createContext<DemoSettings>({
  dark: false,
  locale: 'fr',
  rtl: false,
});

export function useDemo() {
  return useContext(DemoContext);
}

/** Tiny translation helper for the demo screens themselves. */
export function useT() {
  const { locale } = useDemo();
  return (fr: string, en: string) => (locale === 'fr' ? fr : en);
}

export const palette = {
  light: {
    background: '#F5F6F8',
    card: '#FFFFFF',
    text: '#111827',
    muted: '#4B5563',
    border: '#E5E7EB',
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    code: '#F3F4F6',
    success: '#15803D',
    error: '#C81E1E',
  },
  dark: {
    background: '#0B1220',
    card: '#111827',
    text: '#F9FAFB',
    muted: '#D1D5DB',
    border: '#1F2937',
    primary: '#60A5FA',
    onPrimary: '#0B1220',
    code: '#1F2937',
    success: '#4ADE80',
    error: '#F87171',
  },
};

export function usePalette() {
  const { dark } = useDemo();
  return dark ? palette.dark : palette.light;
}
