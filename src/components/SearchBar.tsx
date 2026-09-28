import {
  forwardRef,
  memo,
  type NamedExoticComponent,
  type RefAttributes,
} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { Messages } from '../i18n';
import type { PhoneFieldTheme } from '../theme/types';
import type { TextInputRef } from '../types';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  theme: PhoneFieldTheme;
  messages: Messages;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  onSubmitEditing?: () => void;
}

/** Search field of the country picker, with a clear button. */
export const SearchBar: NamedExoticComponent<
  SearchBarProps & RefAttributes<TextInputRef>
> = memo(
  forwardRef<TextInputRef, SearchBarProps>(function SearchBar(
    {
      value,
      onChangeText,
      placeholder,
      autoFocus,
      theme,
      messages,
      style,
      inputStyle,
      onSubmitEditing,
    },
    ref
  ) {
    const { colors } = theme;
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surface,
            borderRadius: theme.radius.search,
            paddingHorizontal: theme.spacing.md,
          },
          style,
        ]}
      >
        <MagnifierIcon color={colors.placeholder} />
        <TextInput
          ref={ref}
          testID="phone-field-search-input"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          clearButtonMode="never"
          returnKeyType="search"
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel={placeholder}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: theme.fontSizes.search,
              fontFamily: theme.fontFamily.regular,
              marginStart: theme.spacing.sm,
            },
            inputStyle,
          ]}
        />
        {value ? (
          <Pressable
            testID="phone-field-search-clear"
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel={messages.clearSearch}
            hitSlop={12}
            style={[styles.clear, { backgroundColor: colors.placeholder }]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.clearGlyph, { color: colors.surface }]}
            >
              ✕
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  })
);

/** Magnifier drawn with views: no icon font, no asset. */
function MagnifierIcon({ color }: { color: string }) {
  return (
    <View
      style={styles.icon}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.lens, { borderColor: color }]} />
      <View style={[styles.handle, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  input: { flex: 1, paddingVertical: 10 },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearGlyph: { fontSize: 10, fontWeight: '700' },
  icon: { width: 16, height: 16 },
  lens: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  handle: {
    position: 'absolute',
    width: 6,
    height: 2,
    borderRadius: 1,
    right: 0,
    bottom: 2,
    transform: [{ rotate: '45deg' }],
  },
});
