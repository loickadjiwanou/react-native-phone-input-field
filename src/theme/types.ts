import type { TextStyle } from 'react-native';

export interface ThemeColors {
  /** Focus ring, links, selected row accents. */
  primary: string;
  /** Idle border (≥ 3:1 against `background`, WCAG 1.4.11). */
  border: string;
  error: string;
  success: string;
  /** Main text. */
  text: string;
  /** Secondary text (calling codes, helper text, section headers). */
  textSecondary: string;
  placeholder: string;
  /** Field and modal background. */
  background: string;
  /** Filled variant, search bar, section headers. */
  surface: string;
  disabled: string;
  /** Modal backdrop color, shown at `backdropOpacity` (default 0.4). */
  overlay: string;
  /** Selected country row tint. */
  highlight: string;
  /** Vertical separator between the country trigger and the input. */
  separator: string;
}

export type FieldSize = 'sm' | 'md' | 'lg';

export interface SizeTokens {
  /** Minimum field height (grows with font scaling). */
  height: number;
  fontSize: number;
  flagSize: number;
  paddingHorizontal: number;
}

export interface PhoneFieldTheme {
  colors: ThemeColors;
  radius: { field: number; modal: number; item: number; search: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  fontFamily: {
    regular: TextStyle['fontFamily'];
    medium: TextStyle['fontFamily'];
    bold: TextStyle['fontFamily'];
  };
  fontSizes: {
    label: number;
    helper: number;
    callingCode: number;
    modalTitle: number;
    item: number;
    sectionHeader: number;
    search: number;
  };
  borderWidth: { normal: number; focus: number };
  sizes: Record<FieldSize, SizeTokens>;
  /** Height of a country row in the picker (before font scaling). */
  countryItemHeight: number;
  /** Border color transition, in ms. */
  animationDuration: number;
}

export type ColorScheme = 'auto' | 'light' | 'dark';
