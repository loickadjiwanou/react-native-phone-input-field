import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  usePhoneField,
  type PhoneFieldController,
  type UsePhoneFieldOptions,
} from '../hooks/usePhoneField';
import { interpolate } from '../i18n';
import {
  usePhoneFieldTheme,
  usePhoneFieldThemeContext,
} from '../theme/ThemeProvider';
import type {
  ColorScheme,
  FieldSize,
  PhoneFieldTheme,
  ThemeColors,
} from '../theme/types';
import type {
  CountryCode,
  DeepPartial,
  PhoneFieldState,
  PhoneValue,
} from '../types';
import {
  CountryPickerModal,
  type CountryPickerRenderProps,
  type ModalAnimationProps,
  type ModalPresentation,
  type ModalStyles,
  type RenderCountryItemInfo,
  type RenderModalHeaderProps,
  type RenderSearchBarProps,
} from './CountryPickerModal';
import { CountryTrigger, type RenderChevron } from './CountryTrigger';
import type { RenderFlag } from './Flag';
import { HelperText } from './HelperText';
import { StatusIcon } from './StatusIcon';

export type PhoneFieldVariant = 'outlined' | 'filled' | 'underlined';

/** Imperative API, typically called by the form's submit button. */
export interface PhoneFieldRef {
  /** Shows errors (even `incomplete`), shakes on error, returns the value. */
  validate(): PhoneValue;
  isValid(): boolean;
  getValue(): PhoneValue;
  /** E.164, international, or national digits for `country`. */
  setValue(value: string, country?: CountryCode): void;
  setCountry(country: CountryCode): void;
  /** Server error (e.g. "number already used"). `null` clears it. */
  setError(message: string | null): void;
  clear(): void;
  focus(): void;
  blur(): void;
  openCountryPicker(): void;
  closeCountryPicker(): void;
  /** Shake the field (always, regardless of `animateOnError`). */
  shake(): void;
}

export interface PhoneFieldProps extends UsePhoneFieldOptions {
  // ── UI ───────────────────────────────────────────────────────────────
  label?: string;
  /** Text under the field when there is no error. */
  helperText?: string;
  /**
   * Show validation messages under the field. Default `false`: only the
   * border color changes (the message is still read by screen readers).
   * Server errors (`ref.setError`, `error="…"`) are always shown.
   */
  showErrorMessage?: boolean;
  /** Show "Valid number · Mobile" under a valid number. Default `false`. */
  showValidMessage?: boolean;
  showFlag?: boolean;
  /** Default: `countrySelectable`. */
  showChevron?: boolean;
  showCallingCode?: boolean;
  /** ✓ / ! icon on the right of the field. Default `false`. */
  showStatusIcon?: boolean;
  /** Clear button inside the field. Default `false`. */
  clearable?: boolean;
  /** Shake the field when `ref.validate()` fails. Default `false`. */
  animateOnError?: boolean;
  /**
   * Use `colors.primary` for the border while focused. Default `false`: the
   * border only turns green (valid) or red (error).
   */
  highlightOnFocus?: boolean;
  size?: FieldSize;
  variant?: PhoneFieldVariant;
  /** Size of the flag emoji; defaults to the size preset. */
  flagSize?: number;

  // ── Theme ────────────────────────────────────────────────────────────
  theme?: DeepPartial<PhoneFieldTheme>;
  colors?: Partial<ThemeColors>;
  colorScheme?: ColorScheme;

  // ── Styles ───────────────────────────────────────────────────────────
  /** Outer wrapper (label + field + helper). */
  containerStyle?: StyleProp<ViewStyle>;
  /** The bordered field. */
  fieldStyle?: StyleProp<ViewStyle>;
  /** Field style per state. `invalid` also applies whenever an error is visible. */
  containerStyleByState?: Partial<
    Record<PhoneFieldState, StyleProp<ViewStyle>>
  >;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  countryTriggerStyle?: StyleProp<ViewStyle>;
  flagStyle?: StyleProp<TextStyle>;
  chevronStyle?: StyleProp<TextStyle>;
  callingCodeStyle?: StyleProp<TextStyle>;
  helperTextStyle?: StyleProp<TextStyle>;
  errorTextStyle?: StyleProp<TextStyle>;
  modalStyles?: ModalStyles;

  // ── Render props ─────────────────────────────────────────────────────
  renderFlag?: RenderFlag;
  renderChevron?: RenderChevron;
  renderStatusIcon?: (
    state: PhoneFieldState,
    errorVisible: boolean
  ) => ReactNode;
  renderLeft?: (field: PhoneFieldController) => ReactNode;
  renderRight?: (field: PhoneFieldController) => ReactNode;
  renderCountryItem?: (info: RenderCountryItemInfo) => ReactNode;
  renderSearchBar?: (props: RenderSearchBarProps) => ReactNode;
  renderModalHeader?: (props: RenderModalHeaderProps) => ReactNode;
  renderEmpty?: (query: string) => ReactNode;
  /** Replace the whole picker (e.g. with @gorhom/bottom-sheet). */
  renderModal?: (props: CountryPickerRenderProps) => ReactNode;

  // ── Modal ────────────────────────────────────────────────────────────
  modalPresentation?: ModalPresentation;
  modalTitle?: string;
  searchPlaceholder?: string;
  autoFocusSearch?: boolean;
  showAlphabetIndex?: boolean;
  closeOnBackdropPress?: boolean;
  /** Focus the input again after picking a country. Default `true`. */
  refocusAfterSelect?: boolean;
  /**
   * Picker animation, `react-native-modal` style: `animationIn`
   * (`'fadeInUp'`), `animationOut` (`'fadeOutDown'`), `animationInTiming`
   * (350), `animationOutTiming` (300), `backdropTransitionInTiming` (350),
   * `backdropTransitionOutTiming` (300), `backdropOpacity` (0.4),
   * `onBackdropPress`, `hideModalContentWhileAnimating` (`true`),
   * `swipeToClose` (`true`).
   */
  modalProps?: ModalAnimationProps;

  // ── Passthrough ──────────────────────────────────────────────────────
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText'>;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * International phone input: `[🇧🇯 ▾ +229 | 01 97 12 34 56  ✓]`, with a
 * country picker, as-you-type formatting and real-time validation.
 *
 * @example
 * const ref = useRef<PhoneFieldRef>(null);
 * <PhoneField ref={ref} defaultCountry="BJ" allowedNumberTypes={['MOBILE']} required />
 * <Button title="Continuer" onPress={() => {
 *   const res = ref.current!.validate();
 *   if (res.isValid) api.sendOtp(res.e164);
 * }} />
 */
export const PhoneField = forwardRef<PhoneFieldRef, PhoneFieldProps>(
  function PhoneField(props, ref) {
    const context = usePhoneFieldThemeContext();
    const {
      label,
      helperText,
      showErrorMessage = false,
      showValidMessage = false,
      showFlag = true,
      showCallingCode = true,
      showStatusIcon = false,
      clearable = false,
      animateOnError = false,
      highlightOnFocus = false,
      size = 'md',
      variant = 'outlined',
      theme: themeProp,
      colors: colorsProp,
      colorScheme,
      containerStyle,
      fieldStyle,
      containerStyleByState,
      inputStyle,
      labelStyle,
      countryTriggerStyle,
      flagStyle,
      chevronStyle,
      callingCodeStyle,
      helperTextStyle,
      errorTextStyle,
      modalStyles,
      renderFlag,
      renderChevron,
      renderStatusIcon,
      renderLeft,
      renderRight,
      renderCountryItem,
      renderSearchBar,
      renderModalHeader,
      renderEmpty,
      renderModal,
      modalPresentation = 'bottomSheet',
      modalTitle,
      searchPlaceholder,
      autoFocusSearch,
      showAlphabetIndex,
      closeOnBackdropPress,
      refocusAfterSelect = true,
      modalProps,
      inputProps,
      testID = 'phone-field',
      accessibilityLabel,
    } = props;

    const field = usePhoneField({
      ...props,
      locale: props.lang ?? props.locale ?? context.locale,
      messages: props.messages ?? context.messages,
    });
    const { theme } = usePhoneFieldTheme(themeProp, colorsProp, colorScheme);
    const { colors } = theme;
    const sizeTokens = theme.sizes[size];
    const showChevron = props.showChevron ?? field.countrySelectable;

    // ── Border color (native driver) ─────────────────────────────────────
    const { state, errorVisible, isFocused, editable } = field;
    const targetColor = !editable
      ? colors.disabled
      : errorVisible
        ? colors.error
        : state === 'valid'
          ? colors.success
          : isFocused && highlightOnFocus
            ? colors.primary
            : colors.border;
    // One transition per target color. The start color is captured when the
    // target changes, so re-renders during the animation do not cut it short.
    const settledColorRef = useRef(targetColor);
    const transition = useMemo(
      () => ({
        from: settledColorRef.current,
        progress: new Animated.Value(
          settledColorRef.current === targetColor ? 1 : 0
        ),
      }),
      [targetColor]
    );
    useEffect(() => {
      settledColorRef.current = targetColor;
      Animated.timing(transition.progress, {
        toValue: 1,
        duration: theme.animationDuration,
        useNativeDriver: true,
      }).start();
    }, [transition, targetColor, theme.animationDuration]);
    const borderColor = transition.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [transition.from, targetColor],
    });

    // ── Shake ────────────────────────────────────────────────────────────
    const shakeX = useRef(new Animated.Value(0)).current;
    const shake = useCallback(() => {
      shakeX.setValue(0);
      const step = (toValue: number) =>
        Animated.timing(shakeX, {
          toValue,
          duration: 50,
          useNativeDriver: true,
        });
      Animated.sequence([
        step(10),
        step(-10),
        step(7),
        step(-7),
        step(3),
        step(0),
      ]).start();
    }, [shakeX]);

    // ── Picker / refocus ─────────────────────────────────────────────────
    const refocusPending = useRef(false);
    const { selectCountry, focus } = field;
    const handleSelect = useCallback(
      (code: CountryCode) => {
        refocusPending.current = refocusAfterSelect;
        selectCountry(code);
        if (renderModal && refocusAfterSelect) {
          // Custom pickers do not report the end of their animation.
          setTimeout(() => focus(), 300);
          refocusPending.current = false;
        }
      },
      [refocusAfterSelect, selectCountry, renderModal, focus]
    );
    const handleClosed = useCallback(() => {
      if (refocusPending.current) {
        refocusPending.current = false;
        focus();
      }
    }, [focus]);

    // ── Imperative API ───────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      (): PhoneFieldRef => ({
        validate: () => {
          const result = field.validate();
          if (!result.isValid && animateOnError) shake();
          return result;
        },
        isValid: () => field.getValue().isValid,
        getValue: field.getValue,
        setValue: field.setValue,
        setCountry: field.setCountry,
        setError: field.setError,
        clear: field.clear,
        focus: field.focus,
        blur: field.blur,
        openCountryPicker: field.openPicker,
        closeCountryPicker: field.closePicker,
        shake,
      }),
      [field, shake, animateOnError]
    );

    // ── Helper text ──────────────────────────────────────────────────────
    const validMessage =
      showValidMessage && state === 'valid'
        ? field.value.type
          ? interpolate(field.messages.validNumberWithType, {
              type: capitalize(field.messages.numberTypes[field.value.type]),
            })
          : field.messages.validNumber
        : null;
    const showError =
      errorVisible && (showErrorMessage || field.externalErrorMessage !== null);
    const helperMessage = showError
      ? field.errorMessage
      : (validMessage ?? helperText ?? null);
    const helperColor = showError
      ? colors.error
      : state === 'valid'
        ? colors.success
        : colors.textSecondary;

    // ── Layout ───────────────────────────────────────────────────────────
    const borderWidth = isFocused
      ? theme.borderWidth.focus
      : theme.borderWidth.normal;
    // Compensate the thicker focus border so the content does not move.
    const inset =
      sizeTokens.paddingHorizontal - (borderWidth - theme.borderWidth.normal);
    const variantStyle: ViewStyle =
      variant === 'outlined'
        ? {
            borderWidth,
            borderRadius: theme.radius.field,
            paddingHorizontal: inset,
            backgroundColor: colors.background,
          }
        : variant === 'filled'
          ? {
              borderBottomWidth: borderWidth,
              borderTopLeftRadius: theme.radius.field,
              borderTopRightRadius: theme.radius.field,
              paddingHorizontal: sizeTokens.paddingHorizontal,
              paddingBottom: theme.borderWidth.focus - borderWidth,
              backgroundColor: colors.surface,
            }
          : {
              borderBottomWidth: borderWidth,
              paddingBottom: theme.borderWidth.focus - borderWidth,
            };

    const stateStyles = containerStyleByState
      ? [
          containerStyleByState[state],
          errorVisible && state !== 'invalid'
            ? containerStyleByState.invalid
            : null,
        ]
      : null;

    const statusKind = errorVisible
      ? 'invalid'
      : state === 'valid'
        ? 'valid'
        : null;
    const inputA11yLabel =
      accessibilityLabel ?? label ?? field.messages.inputLabel;

    const pickerProps: CountryPickerRenderProps = {
      visible: field.isPickerOpen,
      onClose: field.closePicker,
      countries: field.countries,
      onSelect: handleSelect,
      selected: field.country,
      preferredCountries: field.preferredCountries,
      recentCountries: field.recentCountries,
      messages: field.messages,
      theme,
    };

    return (
      <View
        testID={testID}
        style={[!editable && styles.disabled, containerStyle]}
      >
        {label ? (
          <Text
            nativeID={`${testID}-label`}
            style={[
              styles.label,
              {
                color: showError ? colors.error : colors.text,
                fontSize: theme.fontSizes.label,
                fontFamily: theme.fontFamily.medium,
                marginBottom: theme.spacing.sm,
              },
              labelStyle,
            ]}
          >
            {label}
            {props.required ? (
              <Text style={{ color: colors.error }}> *</Text>
            ) : null}
          </Text>
        ) : null}
        <Animated.View
          testID={`${testID}-container`}
          style={[
            styles.field,
            { minHeight: sizeTokens.height },
            variantStyle,
            { borderColor, transform: [{ translateX: shakeX }] },
            fieldStyle,
            stateStyles,
          ]}
        >
          {renderLeft?.(field)}
          <CountryTrigger
            country={field.country}
            open={field.isPickerOpen}
            onPress={field.openPicker}
            disabled={!field.countrySelectable || !editable}
            theme={theme}
            messages={field.messages}
            flagSize={props.flagSize ?? sizeTokens.flagSize}
            fontSize={sizeTokens.fontSize}
            showFlag={showFlag}
            showChevron={showChevron}
            showCallingCode={showCallingCode}
            style={countryTriggerStyle}
            flagStyle={flagStyle}
            chevronStyle={chevronStyle}
            callingCodeStyle={callingCodeStyle}
            renderFlag={renderFlag}
            renderChevron={renderChevron}
            testID={`${testID}-country-trigger`}
          />
          <TextInput
            ref={field.inputRef}
            testID={`${testID}-input`}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            importantForAutofill="yes"
            autoCorrect={false}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={inputA11yLabel}
            accessibilityHint={
              errorVisible ? (field.errorMessage ?? undefined) : helperText
            }
            accessibilityLabelledBy={label ? `${testID}-label` : undefined}
            {...inputProps}
            value={field.text}
            onChangeText={field.onChangeText}
            onFocus={field.onFocus}
            onBlur={field.onBlur}
            onSelectionChange={field.onSelectionChange}
            selection={field.selection}
            editable={editable}
            placeholder={field.placeholder}
            style={[
              styles.input,
              {
                color: editable ? colors.text : colors.textSecondary,
                fontSize: sizeTokens.fontSize,
                fontFamily: theme.fontFamily.regular,
                marginStart: theme.spacing.md,
              },
              inputStyle,
            ]}
          />
          {clearable && field.text && editable ? (
            <Pressable
              testID={`${testID}-clear`}
              onPress={field.clear}
              accessibilityRole="button"
              accessibilityLabel={field.messages.clearInput}
              hitSlop={10}
              style={[styles.clear, { backgroundColor: colors.placeholder }]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.clearGlyph, { color: colors.background }]}
              >
                ✕
              </Text>
            </Pressable>
          ) : null}
          {showStatusIcon && statusKind ? (
            <View style={{ marginStart: theme.spacing.sm }}>
              {renderStatusIcon ? (
                renderStatusIcon(state, errorVisible)
              ) : (
                <StatusIcon
                  kind={statusKind}
                  color={statusKind === 'valid' ? colors.success : colors.error}
                  contrastColor={colors.background}
                />
              )}
            </View>
          ) : null}
          {renderRight?.(field)}
        </Animated.View>
        <HelperText
          message={helperMessage}
          color={helperColor}
          fontSize={theme.fontSizes.helper}
          fontFamily={theme.fontFamily.regular}
          style={showError ? errorTextStyle : helperTextStyle}
          live={showError}
          testID={showError ? `${testID}-error` : `${testID}-helper`}
        />
        {renderModal ? (
          renderModal(pickerProps)
        ) : (
          <CountryPickerModal
            {...modalProps}
            {...pickerProps}
            presentation={modalPresentation}
            title={modalTitle}
            searchPlaceholder={searchPlaceholder}
            autoFocusSearch={autoFocusSearch}
            showAlphabetIndex={showAlphabetIndex}
            closeOnBackdropPress={closeOnBackdropPress}
            styles={modalStyles}
            flagSize={props.flagSize ?? 24}
            renderFlag={renderFlag}
            renderCountryItem={renderCountryItem}
            renderSearchBar={renderSearchBar}
            renderHeader={renderModalHeader}
            renderEmpty={renderEmpty}
            onClosed={handleClosed}
          />
        )}
      </View>
    );
  }
);

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.6 },
  label: { fontWeight: '500' },
  field: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 0,
    writingDirection: 'ltr',
    fontVariant: ['tabular-nums'],
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: 8,
  },
  clearGlyph: { fontSize: 10, fontWeight: '700' },
});
