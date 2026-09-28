import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { Messages } from '../i18n';
import type { DeepPartial } from '../types';
import { deepMerge } from '../utils/deepMerge';
import { darkTheme } from './darkTheme';
import { defaultTheme } from './defaultTheme';
import type { ColorScheme, PhoneFieldTheme, ThemeColors } from './types';

export interface PhoneFieldThemeContextValue {
  /** Overrides applied in light mode. */
  theme?: DeepPartial<PhoneFieldTheme>;
  /** Overrides applied in dark mode (defaults to `theme`). */
  darkTheme?: DeepPartial<PhoneFieldTheme>;
  colorScheme?: ColorScheme;
  /** App-wide language of every `PhoneField`. */
  locale?: string;
  /** App-wide message overrides. */
  messages?: DeepPartial<Messages>;
}

const PhoneFieldThemeContext = createContext<PhoneFieldThemeContextValue>({});

export interface PhoneFieldThemeProviderProps extends PhoneFieldThemeContextValue {
  children: ReactNode;
}

/**
 * App-wide theme and language for every `PhoneField` below it.
 *
 * @example
 * <PhoneFieldThemeProvider theme={{ colors: { primary: '#7C3AED' } }} locale="en">
 *   <App />
 * </PhoneFieldThemeProvider>
 */
export function PhoneFieldThemeProvider({
  children,
  ...value
}: PhoneFieldThemeProviderProps) {
  const parent = useContext(PhoneFieldThemeContext);
  const { theme, darkTheme: dark, colorScheme, locale, messages } = value;
  const merged = useMemo<PhoneFieldThemeContextValue>(
    () => ({
      theme: theme ? deepMerge(parent.theme ?? {}, theme) : parent.theme,
      darkTheme: dark
        ? deepMerge(parent.darkTheme ?? {}, dark)
        : parent.darkTheme,
      colorScheme: colorScheme ?? parent.colorScheme,
      locale: locale ?? parent.locale,
      messages: messages
        ? deepMerge(parent.messages ?? {}, messages)
        : parent.messages,
    }),
    [parent, theme, dark, colorScheme, locale, messages]
  );
  return (
    <PhoneFieldThemeContext.Provider value={merged}>
      {children}
    </PhoneFieldThemeContext.Provider>
  );
}

export function usePhoneFieldThemeContext(): PhoneFieldThemeContextValue {
  return useContext(PhoneFieldThemeContext);
}

/**
 * Resolves the theme: base (light/dark) → provider → `theme` prop →
 * `colors` prop.
 */
export function usePhoneFieldTheme(
  themeProp?: DeepPartial<PhoneFieldTheme>,
  colorsProp?: Partial<ThemeColors>,
  colorSchemeProp?: ColorScheme
): { theme: PhoneFieldTheme; isDark: boolean } {
  const context = useContext(PhoneFieldThemeContext);
  const system = useColorScheme();
  const scheme = colorSchemeProp ?? context.colorScheme ?? 'auto';
  const isDark = scheme === 'dark' || (scheme === 'auto' && system === 'dark');
  const theme = useMemo(() => {
    const base = isDark ? darkTheme : defaultTheme;
    const providerTheme = isDark
      ? (context.darkTheme ?? context.theme)
      : context.theme;
    return deepMerge(
      base,
      providerTheme,
      themeProp,
      colorsProp ? { colors: colorsProp } : undefined
    );
  }, [isDark, context.theme, context.darkTheme, themeProp, colorsProp]);
  return { theme, isDark };
}
