import { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export type StatusIconKind = 'valid' | 'invalid';

export interface StatusIconProps {
  kind: StatusIconKind;
  color: string;
  /** Glyph color inside the disc. */
  contrastColor?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * ✓ / ! disc on the right of the field. Decorative: the state is also given
 * as text (helper / error message) and announced to screen readers.
 */
export const StatusIcon = memo(function StatusIcon({
  kind,
  color,
  contrastColor = '#FFFFFF',
  size = 20,
  style,
}: StatusIconProps) {
  return (
    <View
      testID={`status-icon-${kind}`}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        styles.disc,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.glyph,
          { color: contrastColor, fontSize: size * 0.62, lineHeight: size },
        ]}
      >
        {kind === 'valid' ? '✓' : '!'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontWeight: '800', textAlign: 'center', includeFontPadding: false },
});
