import {
  darkTheme,
  defaultTheme,
  type PhoneFieldTheme,
} from 'react-native-phone-input-field';

/** WCAG 2.x relative luminance / contrast ratio. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

describe.each<[string, PhoneFieldTheme]>([
  ['light', defaultTheme],
  ['dark', darkTheme],
])('%s theme contrast (WCAG AA)', (_name, theme) => {
  const { colors } = theme;
  it.each([
    'text',
    'textSecondary',
    'placeholder',
    'error',
    'success',
    'primary',
  ] as const)('%s ≥ 4.5:1 on background and surface', (key) => {
    expect(contrast(colors[key], colors.background)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(contrast(colors[key], colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('text ≥ 4.5:1 on the selected row tint', () => {
    expect(contrast(colors.text, colors.highlight)).toBeGreaterThanOrEqual(4.5);
  });

  it('idle border ≥ 3:1 (non-text contrast)', () => {
    expect(contrast(colors.border, colors.background)).toBeGreaterThanOrEqual(
      3
    );
  });
});
