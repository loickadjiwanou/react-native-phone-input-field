import { memo, useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
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
import type { Country } from '../types';
import { Flag, type RenderFlag } from './Flag';

export type RenderChevron = (open: boolean) => ReactNode;

export interface CountryTriggerProps {
  country: Country;
  open: boolean;
  onPress: () => void;
  disabled?: boolean;
  theme: PhoneFieldTheme;
  messages: Messages;
  flagSize: number;
  fontSize: number;
  showFlag?: boolean;
  showChevron?: boolean;
  showCallingCode?: boolean;
  /** Vertical separator between the trigger and the input. Default `true`. */
  showSeparator?: boolean;
  style?: StyleProp<ViewStyle>;
  flagStyle?: StyleProp<TextStyle>;
  chevronStyle?: StyleProp<TextStyle>;
  callingCodeStyle?: StyleProp<TextStyle>;
  separatorStyle?: StyleProp<ViewStyle>;
  renderFlag?: RenderFlag;
  renderChevron?: RenderChevron;
  testID?: string;
}

/**
 * `[ 🇧🇯 ▾ +229 | ]`: opens the country picker. The chevron rotates 180°
 * while the picker is open.
 */
export const CountryTrigger = memo(function CountryTrigger({
  country,
  open,
  onPress,
  disabled,
  theme,
  messages,
  flagSize,
  fontSize,
  showFlag = true,
  showChevron = true,
  showCallingCode = true,
  showSeparator = true,
  style,
  flagStyle,
  chevronStyle,
  callingCodeStyle,
  separatorStyle,
  renderFlag,
  renderChevron,
  testID = 'phone-field-country-trigger',
}: CountryTriggerProps) {
  const rotation = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rotation, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, rotation]);
  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const label = interpolate(messages.countryButtonLabel, {
    country: country.name,
    callingCode: country.callingCode,
  });

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={disabled ? undefined : messages.countryButtonHint}
      accessibilityState={{ expanded: open, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.trigger,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {showFlag ? (
        <Flag
          iso2={country.iso2}
          size={flagSize}
          style={flagStyle}
          renderFlag={renderFlag}
          fallbackBackground={theme.colors.surface}
          fallbackColor={theme.colors.text}
        />
      ) : null}
      {showChevron ? (
        <Animated.View
          style={[
            styles.chevronBox,
            {
              marginStart: showFlag ? theme.spacing.xs : 0,
              transform: [{ rotate }],
            },
          ]}
        >
          {renderChevron ? (
            renderChevron(open)
          ) : (
            <Text
              allowFontScaling={false}
              style={[
                styles.chevron,
                { color: theme.colors.textSecondary },
                chevronStyle,
              ]}
            >
              ▾
            </Text>
          )}
        </Animated.View>
      ) : null}
      {showCallingCode ? (
        <Text
          // Calling codes are always left-to-right ("+229"), even in RTL.
          style={[
            styles.callingCode,
            {
              marginStart: showFlag || showChevron ? theme.spacing.sm : 0,
              color: theme.colors.text,
              fontSize,
              fontFamily: theme.fontFamily.medium,
            },
            callingCodeStyle,
          ]}
        >
          {`⁦+${country.callingCode}⁩`}
        </Text>
      ) : null}
      {showSeparator ? (
        <View
          style={[
            styles.separator,
            {
              backgroundColor: theme.colors.separator,
              marginStart: theme.spacing.md,
            },
            separatorStyle,
          ]}
        />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 44,
  },
  pressed: { opacity: 0.6 },
  chevronBox: { alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 14 },
  callingCode: { fontWeight: '500', writingDirection: 'ltr' },
  separator: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginVertical: 10,
  },
});
