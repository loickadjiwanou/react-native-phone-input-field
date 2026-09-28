import { memo, type ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { getFlagEmoji, NON_RGI_FLAGS } from '../core/countries';
import type { CountryCode } from '../types';

export type RenderFlag = (iso2: CountryCode, size: number) => ReactNode;

export interface FlagProps {
  iso2: CountryCode;
  /** Font size of the emoji / diameter of the ISO badge. */
  size?: number;
  style?: StyleProp<TextStyle>;
  /** Replace the emoji with an image, an SVG… */
  renderFlag?: RenderFlag;
  /** Force the ISO badge instead of the emoji. */
  forceFallback?: boolean;
  /** Badge colors. */
  fallbackBackground?: string;
  fallbackColor?: string;
}

/** Windows does not ship flag emoji: fall back on ISO badges on the web there. */
function platformLacksFlagEmoji(): boolean {
  if (Platform.OS !== 'web') return false;
  const nav = (globalThis as { navigator?: { userAgent?: string } }).navigator;
  return /Windows/i.test(nav?.userAgent ?? '');
}

const LACKS_EMOJI = platformLacksFlagEmoji();

/**
 * Country flag: Unicode emoji by default (no asset), ISO badge when the
 * emoji cannot be displayed, or anything via `renderFlag`.
 */
export const Flag = memo(function Flag({
  iso2,
  size = 22,
  style,
  renderFlag,
  forceFallback,
  fallbackBackground = '#E5E7EB',
  fallbackColor = '#111827',
}: FlagProps) {
  if (renderFlag) return <>{renderFlag(iso2, size)}</>;
  if (forceFallback || LACKS_EMOJI || NON_RGI_FLAGS.has(iso2)) {
    const diameter = Math.round(size * 1.2);
    return (
      <View
        testID={`flag-fallback-${iso2}`}
        style={[
          styles.badge,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: fallbackBackground,
          },
        ]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.badgeText,
            { fontSize: size * 0.45, color: fallbackColor },
          ]}
        >
          {iso2}
        </Text>
      </View>
    );
  }
  return (
    <Text
      testID={`flag-${iso2}`}
      allowFontScaling={false}
      style={[
        { fontSize: size, lineHeight: Math.round(size * 1.25) },
        styles.emoji,
        style,
      ]}
      importantForAccessibility="no"
      accessibilityElementsHidden
    >
      {getFlagEmoji(iso2)}
    </Text>
  );
});

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '700' },
  emoji: { includeFontPadding: false, textAlignVertical: 'center' },
});
