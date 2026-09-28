import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { interpolate, type Messages } from '../i18n';
import type { PhoneFieldTheme } from '../theme/types';
import type { Country, CountryCode } from '../types';
import { Flag, type RenderFlag } from './Flag';

export interface CountryListItemProps {
  country: Country;
  selected: boolean;
  onSelect: (code: CountryCode) => void;
  height: number;
  theme: PhoneFieldTheme;
  messages: Messages;
  flagSize?: number;
  renderFlag?: RenderFlag;
  style?: StyleProp<ViewStyle>;
  selectedStyle?: StyleProp<ViewStyle>;
  nameStyle?: StyleProp<TextStyle>;
  callingCodeStyle?: StyleProp<TextStyle>;
}

/** One row of the picker: flag, name, calling code, ✓ when selected. */
export const CountryListItem = memo(function CountryListItem({
  country,
  selected,
  onSelect,
  height,
  theme,
  messages,
  flagSize = 24,
  renderFlag,
  style,
  selectedStyle,
  nameStyle,
  callingCodeStyle,
}: CountryListItemProps) {
  const { colors, spacing } = theme;
  const label = interpolate(messages.selectCountryLabel, {
    country: country.name,
    callingCode: country.callingCode,
  });
  return (
    <Pressable
      testID={`country-item-${country.iso2}`}
      onPress={() => onSelect(country.iso2)}
      accessibilityRole="button"
      accessibilityLabel={
        selected ? `${label}, ${messages.selectedCountry}` : label
      }
      accessibilityState={{ selected }}
      android_ripple={{ color: colors.highlight }}
      style={({ pressed }) => [
        styles.row,
        {
          height,
          paddingHorizontal: spacing.lg,
          borderRadius: theme.radius.item,
        },
        selected && { backgroundColor: colors.highlight },
        selected && selectedStyle,
        pressed && { backgroundColor: colors.surface },
        style,
      ]}
    >
      <View style={[styles.flag, { width: flagSize * 1.4 }]}>
        <Flag
          iso2={country.iso2}
          size={flagSize}
          renderFlag={renderFlag}
          fallbackBackground={colors.surface}
          fallbackColor={colors.text}
        />
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.name,
          {
            color: colors.text,
            fontSize: theme.fontSizes.item,
            fontFamily: selected
              ? theme.fontFamily.medium
              : theme.fontFamily.regular,
            marginHorizontal: spacing.md,
          },
          selected && styles.nameSelected,
          nameStyle,
        ]}
      >
        {country.name}
      </Text>
      <Text
        style={[
          styles.callingCode,
          {
            color: colors.textSecondary,
            fontSize: theme.fontSizes.item,
            fontFamily: theme.fontFamily.regular,
          },
          callingCodeStyle,
        ]}
      >
        {`⁦+${country.callingCode}⁩`}
      </Text>
      <View style={styles.check}>
        {selected ? (
          <Text
            allowFontScaling={false}
            style={[styles.checkGlyph, { color: colors.primary }]}
          >
            ✓
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  flag: { alignItems: 'center' },
  name: { flex: 1 },
  nameSelected: { fontWeight: '600' },
  callingCode: { fontVariant: ['tabular-nums'], writingDirection: 'ltr' },
  check: { width: 28, alignItems: 'flex-end' },
  checkGlyph: { fontSize: 18, fontWeight: '700' },
});
