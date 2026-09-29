import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  DEFAULT_EXCLUDED_COUNTRIES,
  getCountries,
  getCountry,
  isCountryAllowed,
} from '../core/countries';
import { getPlaceholderMask } from '../core/formatting';
import {
  parseExternalValue,
  processPhoneInput,
  reformatForCountry,
  type ProcessInputOptions,
} from '../core/input';
import { isSupportedCountryCode } from '../core/metadata';
import {
  analyzePhoneNumber,
  getErrorMessage,
  toPhoneValue,
  type PhoneAnalysis,
  type ValidationOptions,
} from '../core/validation';
import {
  getMessages,
  interpolate,
  type Messages,
  type PhoneFieldLang,
} from '../i18n';
import type {
  Country,
  CountryCode,
  CustomRules,
  CustomValidator,
  DeepPartial,
  InputFocusEvent,
  InputSelectionChangeEvent,
  NumberType,
  PhoneFieldState,
  PhoneValidationError,
  PhoneValue,
  TextInputRef,
} from '../types';
import { resolveDefaultCountry } from './useDefaultCountry';

export type ValidateOn = 'change' | 'blur' | 'submit';
export type ShowIncompleteAsError = 'never' | 'onBlur' | 'always';

export interface UsePhoneFieldOptions {
  // ── Value ────────────────────────────────────────────────────────────
  /** Controlled value: E.164 (`+2290197123456`), international, or national with `country`. */
  value?: string;
  /** Initial value (uncontrolled). Same formats as `value`. */
  defaultValue?: string;
  /** Called on every change with the full phone value. */
  onChangePhone?: (value: PhoneValue) => void;
  /** Called on every change with the displayed (formatted national) text. */
  onChangeText?: (text: string) => void;
  /** Called only when validity flips (and once on mount if initially valid). */
  onValidityChange?: (isValid: boolean, value: PhoneValue) => void;

  // ── Country ──────────────────────────────────────────────────────────
  /** Controlled country. */
  country?: CountryCode;
  /** Initial country. Default: device locale, then `fallbackCountry`. */
  defaultCountry?: CountryCode;
  /** Last-resort country. Default `'BJ'`. */
  fallbackCountry?: CountryCode;
  onCountryChange?: (country: Country) => void;
  /** Countries pinned at the top of the picker. */
  preferredCountries?: readonly CountryCode[];
  /** Only show / accept these countries. */
  onlyCountries?: readonly CountryCode[];
  /** Hide / reject these countries. Default `DEFAULT_EXCLUDED_COUNTRIES`. */
  excludedCountries?: readonly CountryCode[];
  /** Switch country when a `+xxx` number is typed or pasted. Default `true`. */
  autoDetectCountry?: boolean;
  /** Allow opening the picker. `false` freezes the country. Default `true`. */
  countrySelectable?: boolean;
  /** Clear the number when the user picks another country. Default `false`. */
  clearOnCountryChange?: boolean;
  /** Initial recent countries (e.g. restored from storage). */
  recentCountries?: readonly CountryCode[];
  /** Called when the recent countries change, to persist them. */
  onRecentsChange?: (codes: CountryCode[]) => void;
  /** Max number of recent countries. Default `5`. */
  maxRecents?: number;

  // ── Validation ───────────────────────────────────────────────────────
  required?: boolean;
  /** When feedback (red / green) starts. Default `'change'`. */
  validateOn?: ValidateOn;
  /** When an incomplete number is shown as an error. Default `'onBlur'`. */
  showIncompleteAsError?: ShowIncompleteAsError;
  /** Delay before showing an error while typing. Default `0`. */
  errorDebounceMs?: number;
  allowedNumberTypes?: readonly NumberType[];
  customRules?: CustomRules;
  customValidator?: CustomValidator;
  /** Error forced from outside (`true` or a message), e.g. a server error. */
  error?: string | boolean;
  /** Refuse digits beyond the maximum length. Default `true`. */
  limitMaxLength?: boolean;

  // ── Misc ─────────────────────────────────────────────────────────────
  editable?: boolean;
  placeholder?: string;
  /** Called when the number becomes valid (plug your haptics here). */
  onValidHaptic?: () => void;
  /** Announce validity changes to screen readers. Default `true`. */
  announceValidation?: boolean;
  onFocus?: (e: InputFocusEvent) => void;
  onBlur?: (e: InputFocusEvent) => void;
  onModalOpen?: () => void;
  onModalClose?: () => void;

  // ── i18n ─────────────────────────────────────────────────────────────
  /**
   * Language of the modal, country names and messages: `'fr'` (default) or
   * `'en'`. Shortcut for `locale`, and takes precedence over it.
   */
  lang?: PhoneFieldLang;
  /** `'fr'` (default), `'en'`, or any BCP 47 tag. */
  locale?: string;
  messages?: DeepPartial<Messages>;
  countryNameOverrides?: Partial<Record<CountryCode, string>>;
}

export interface PhoneFieldController {
  /** Formatted text of the input. */
  text: string;
  /** Selected country. */
  country: Country;
  /** Full value. `state` and `errorMessage` follow the display rules. */
  value: PhoneValue;
  state: PhoneFieldState;
  error: PhoneValidationError | null;
  /** Message to display under the field, if any. */
  errorMessage: string | null;
  /** Whether the error must be displayed now (red border + message). */
  errorVisible: boolean;
  /** Message from `setError()` or the `error` prop (server errors), if any. */
  externalErrorMessage: string | null;
  isValid: boolean;
  isFocused: boolean;
  placeholder: string;
  messages: Messages;
  editable: boolean;
  countrySelectable: boolean;

  // Picker
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  selectCountry: (code: CountryCode) => void;
  /** Countries allowed in the picker, sorted by name. */
  countries: Country[];
  preferredCountries: Country[];
  recentCountries: Country[];

  // Input wiring
  inputRef: RefObject<TextInputRef | null>;
  onChangeText: (text: string) => void;
  onFocus: (e: InputFocusEvent) => void;
  onBlur: (e: InputFocusEvent) => void;
  onSelectionChange: (e: InputSelectionChangeEvent) => void;
  /** Caret to force after a reformat, `undefined` otherwise. */
  selection: { start: number; end: number } | undefined;

  // Imperative API
  /** Forces error display (even `incomplete`) and returns the value. */
  validate: () => PhoneValue;
  getValue: () => PhoneValue;
  setValue: (value: string, country?: CountryCode) => void;
  setCountry: (code: CountryCode) => void;
  /** Server-side error; cleared when the user edits the number. */
  setError: (message: string | null) => void;
  clear: () => void;
  focus: () => void;
  blur: () => void;
}

interface InteractionState {
  focused: boolean;
  /** Blurred at least once after typing. */
  touched: boolean;
  /** The user typed something. */
  dirty: boolean;
  /** `validate()` was called. */
  submitted: boolean;
}

export interface DisplayInput {
  analysis: PhoneAnalysis;
  isValid: boolean;
  interaction: InteractionState;
  editable: boolean;
  externalError: string | boolean | null | undefined;
  validateOn: ValidateOn;
  showIncompleteAsError: ShowIncompleteAsError;
}

/**
 * Pure display rules (spec §4.2). Exported for testing and for custom UIs.
 */
export function computeDisplayState(input: DisplayInput): {
  state: PhoneFieldState;
  errorVisible: boolean;
} {
  const {
    analysis,
    isValid,
    interaction,
    editable,
    externalError,
    validateOn,
  } = input;
  const { focused, touched, dirty, submitted } = interaction;
  if (!editable) return { state: 'disabled', errorVisible: !!externalError };
  if (externalError) return { state: 'invalid', errorVisible: true };

  const neutral: PhoneFieldState = focused ? 'focused' : 'idle';
  const feedbackActive =
    submitted || validateOn === 'change' || (validateOn === 'blur' && touched);

  if (analysis.isEmpty) {
    if (analysis.error === 'REQUIRED') {
      const show =
        submitted || (validateOn !== 'submit' && dirty && touched && !focused);
      if (show) return { state: 'invalid', errorVisible: true };
    }
    if (analysis.error === 'NOT_A_NUMBER' && feedbackActive) {
      return { state: 'invalid', errorVisible: true };
    }
    return { state: neutral, errorVisible: false };
  }
  if (isValid)
    return { state: feedbackActive ? 'valid' : neutral, errorVisible: false };
  if (
    analysis.severity === 'invalid' ||
    (analysis.severity === 'none' && !isValid)
  ) {
    return feedbackActive
      ? { state: 'invalid', errorVisible: true }
      : { state: neutral, errorVisible: false };
  }
  // Incomplete.
  const mode = input.showIncompleteAsError;
  const show =
    submitted ||
    (feedbackActive &&
      (mode === 'always' || (mode === 'onBlur' && touched && !focused)));
  return { state: 'incomplete', errorVisible: show };
}

/** Rising-edge debounce: `true` is delayed by `ms`, `false` is immediate. */
function useDelayedTrue(flag: boolean, ms: number, bypass: boolean): boolean {
  const [delayed, setDelayed] = useState(flag);
  useEffect(() => {
    if (!flag || ms <= 0 || bypass) {
      setDelayed(flag);
      return undefined;
    }
    const id = setTimeout(() => setDelayed(true), ms);
    return () => clearTimeout(id);
  }, [flag, ms, bypass]);
  return flag && (ms <= 0 || bypass || delayed);
}

/**
 * Headless phone field: every behaviour of `<PhoneField />` without any UI.
 * Wire `onChangeText`, `onFocus`, `onBlur`, `onSelectionChange`, `selection`
 * and `inputRef` to a `TextInput`, and build the rest yourself.
 */
export function usePhoneField(
  rawOptions: UsePhoneFieldOptions = {}
): PhoneFieldController {
  // `lang` is a typed shortcut for `locale`.
  const options = rawOptions.lang
    ? { ...rawOptions, locale: rawOptions.lang }
    : rawOptions;
  const {
    locale,
    messages: messageOverrides,
    countryNameOverrides,
    onlyCountries,
    excludedCountries = DEFAULT_EXCLUDED_COUNTRIES,
    preferredCountries: preferredCodes,
    autoDetectCountry = true,
    countrySelectable = true,
    clearOnCountryChange = false,
    required = false,
    validateOn = 'change',
    showIncompleteAsError = 'onBlur',
    errorDebounceMs = 0,
    allowedNumberTypes,
    customRules,
    customValidator,
    limitMaxLength = true,
    editable = true,
    announceValidation = true,
    maxRecents = 5,
  } = options;

  // Latest options, readable from stable callbacks.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const messages = useMemo(
    () => getMessages(locale, messageOverrides),
    [locale, messageOverrides]
  );

  const allowed = useCallback(
    (code: CountryCode) =>
      isCountryAllowed(code, { onlyCountries, excludedCountries }),
    [onlyCountries, excludedCountries]
  );

  const inputOptions: ProcessInputOptions = useMemo(
    () => ({
      onlyCountries,
      excludedCountries,
      autoDetectCountry: autoDetectCountry && countrySelectable,
      customRules,
      limitMaxLength,
    }),
    [
      onlyCountries,
      excludedCountries,
      autoDetectCountry,
      countrySelectable,
      customRules,
      limitMaxLength,
    ]
  );

  const validationOptions: ValidationOptions = useMemo(
    () => ({
      required,
      allowedNumberTypes,
      customRules,
      customValidator,
      onlyCountries,
      excludedCountries,
      autoDetectCountry: autoDetectCountry && countrySelectable,
      locale,
      messages: messageOverrides,
      countryNameOverrides,
    }),
    [
      required,
      allowedNumberTypes,
      customRules,
      customValidator,
      onlyCountries,
      excludedCountries,
      autoDetectCountry,
      countrySelectable,
      locale,
      messageOverrides,
      countryNameOverrides,
    ]
  );

  // ── Initial state ────────────────────────────────────────────────────
  const [initial] = useState(() => {
    const startCountry = resolveDefaultCountry(
      options.country ?? options.defaultCountry,
      {
        onlyCountries,
        excludedCountries,
        preferredCountries: preferredCodes,
        fallbackCountry: options.fallbackCountry,
      }
    );
    const startValue = options.value ?? options.defaultValue;
    return parseExternalValue(startValue, startCountry, inputOptions);
  });

  const [text, setText] = useState(initial.text);
  const [internalCountry, setInternalCountry] = useState<CountryCode>(
    initial.country
  );
  const controlledCountry =
    options.country && isSupportedCountryCode(options.country)
      ? options.country
      : undefined;
  const countryCode = controlledCountry ?? internalCountry;

  const [interaction, setInteraction] = useState<InteractionState>({
    focused: false,
    touched: false,
    dirty: false,
    submitted: false,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [recents, setRecents] = useState<CountryCode[]>(() =>
    [...(options.recentCountries ?? [])].filter(isSupportedCountryCode)
  );
  const [selection, setSelection] = useState<{ start: number; end: number }>();

  const inputRef = useRef<TextInputRef | null>(null);

  // Refs mirror the latest state for imperative calls made before re-render.
  const textRef = useRef(text);
  const countryRef = useRef(countryCode);
  const interactionRef = useRef(interaction);
  textRef.current = text;
  countryRef.current = countryCode;
  interactionRef.current = interaction;

  // ── Derived values ───────────────────────────────────────────────────
  const buildValue = useCallback(
    (
      t: string,
      c: CountryCode,
      inter: InteractionState,
      external: string | boolean | null | undefined
    ): { value: PhoneValue; errorVisible: boolean } => {
      const analysis = analyzePhoneNumber(t, c, validationOptions);
      // Run customValidator once to know the final validity.
      const base = toPhoneValue(analysis, t, 'idle', validationOptions);
      const display = computeDisplayState({
        analysis,
        isValid: base.isValid,
        interaction: inter,
        editable,
        externalError: external,
        validateOn,
        showIncompleteAsError,
      });
      let error = base.error;
      let errorMessage = base.errorMessage;
      if (typeof external === 'string' && external) {
        errorMessage = external;
        error = error ?? 'CUSTOM_RULE';
      } else if (external === true) {
        error = error ?? 'CUSTOM_RULE';
        errorMessage = base.errorMessage;
      }
      return {
        value: { ...base, state: display.state, error, errorMessage },
        errorVisible: display.errorVisible,
      };
    },
    [validationOptions, editable, validateOn, showIncompleteAsError]
  );

  const externalError = serverError ?? options.error;
  const { value, errorVisible: rawErrorVisible } = useMemo(
    () => buildValue(text, countryCode, interaction, externalError),
    [buildValue, text, countryCode, interaction, externalError]
  );

  const errorVisible = useDelayedTrue(
    rawErrorVisible,
    errorDebounceMs,
    interaction.submitted || !!externalError || !interaction.focused
  );
  const state: PhoneFieldState =
    rawErrorVisible && !errorVisible
      ? interaction.focused
        ? 'focused'
        : 'idle'
      : value.state;

  const country = useMemo(
    () => getCountry(countryCode, locale, countryNameOverrides),
    [countryCode, locale, countryNameOverrides]
  );

  const countries = useMemo(
    () =>
      getCountries({
        locale,
        onlyCountries,
        excludedCountries,
        countryNameOverrides,
      }),
    [locale, onlyCountries, excludedCountries, countryNameOverrides]
  );
  const toCountries = useCallback(
    (codes: readonly CountryCode[] | undefined) =>
      (codes ?? [])
        .filter((c) => isSupportedCountryCode(c) && allowed(c))
        .map((c) => getCountry(c, locale, countryNameOverrides)),
    [allowed, locale, countryNameOverrides]
  );
  const preferredCountries = useMemo(
    () => toCountries(preferredCodes),
    [toCountries, preferredCodes]
  );
  const recentCountries = useMemo(
    () => toCountries(recents),
    [toCountries, recents]
  );

  const placeholder = useMemo(
    () => options.placeholder ?? getPlaceholderMask(countryCode),
    [options.placeholder, countryCode]
  );

  // ── Change emission ──────────────────────────────────────────────────
  const lastEmittedRef = useRef<Set<string>>(new Set());

  const emitChange = useCallback(
    (nextText: string, nextCountry: CountryCode) => {
      const { onChangePhone, onChangeText } = optionsRef.current;
      if (!onChangePhone && !onChangeText) return;
      const next = buildValue(
        nextText,
        nextCountry,
        interactionRef.current,
        null
      ).value;
      lastEmittedRef.current = new Set(
        [nextText, next.e164, next.international, next.national].filter(
          (v): v is string => typeof v === 'string'
        )
      );
      onChangeText?.(nextText);
      onChangePhone?.(next);
    },
    [buildValue]
  );

  const applyCountry = useCallback(
    (next: CountryCode, notify: boolean) => {
      if (next === countryRef.current) return;
      countryRef.current = next;
      if (!controlledCountry) setInternalCountry(next);
      if (notify) {
        const { onCountryChange } = optionsRef.current;
        onCountryChange?.(
          getCountry(
            next,
            optionsRef.current.locale,
            optionsRef.current.countryNameOverrides
          )
        );
      }
    },
    [controlledCountry]
  );

  const applyText = useCallback((next: string) => {
    textRef.current = next;
    setText(next);
  }, []);

  // ── Controlled value ─────────────────────────────────────────────────
  const valueProp = options.value;
  useEffect(() => {
    if (valueProp === undefined) return;
    if (lastEmittedRef.current.has(valueProp) || valueProp === textRef.current)
      return;
    const parsed = parseExternalValue(
      valueProp,
      countryRef.current,
      inputOptions
    );
    applyText(parsed.text);
    applyCountry(parsed.country, true);
    lastEmittedRef.current = new Set([valueProp, parsed.text]);
  }, [valueProp, inputOptions, applyText, applyCountry]);

  // ── Validity side effects ────────────────────────────────────────────
  const prevValidRef = useRef(false);
  const isValid = value.isValid;
  useEffect(() => {
    if (prevValidRef.current === isValid) return;
    prevValidRef.current = isValid;
    const { onValidityChange, onValidHaptic } = optionsRef.current;
    onValidityChange?.(isValid, value);
    if (isValid) onValidHaptic?.();
  }, [isValid, value]);

  // Screen reader announcements (color is never the only signal).
  const announcedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!announceValidation) return;
    let message: string | null = null;
    if (state === 'valid') message = messages.announceValid;
    else if (errorVisible && value.errorMessage) {
      message = interpolate(messages.announceInvalid, {
        message: value.errorMessage,
      });
    }
    if (message && message !== announcedRef.current) {
      AccessibilityInfo.announceForAccessibility?.(message);
    }
    announcedRef.current = message;
  }, [announceValidation, state, errorVisible, value.errorMessage, messages]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const onChangeText = useCallback(
    (nextText: string) => {
      const result = processPhoneInput(
        { text: textRef.current, country: countryRef.current },
        nextText,
        inputOptions
      );
      setServerError(null);
      if (!interactionRef.current.dirty) {
        interactionRef.current = { ...interactionRef.current, dirty: true };
        setInteraction(interactionRef.current);
      }
      applyCountry(result.country, true);
      applyText(result.text);
      // Force the caret only when it is not simply at the end.
      setSelection(
        result.caret !== result.text.length || result.rejected
          ? { start: result.caret, end: result.caret }
          : undefined
      );
      // A refused digit changes nothing: no emission.
      if (!result.rejected) emitChange(result.text, result.country);
    },
    [inputOptions, applyCountry, applyText, emitChange]
  );

  const onSelectionChange = useCallback((_e: InputSelectionChangeEvent) => {
    // The native caret has been applied: release the controlled selection.
    setSelection(undefined);
  }, []);

  const onFocus = useCallback((e: InputFocusEvent) => {
    interactionRef.current = { ...interactionRef.current, focused: true };
    setInteraction(interactionRef.current);
    optionsRef.current.onFocus?.(e);
  }, []);

  const onBlur = useCallback((e: InputFocusEvent) => {
    const prev = interactionRef.current;
    interactionRef.current = {
      ...prev,
      focused: false,
      touched: prev.touched || prev.dirty,
    };
    setInteraction(interactionRef.current);
    optionsRef.current.onBlur?.(e);
  }, []);

  const openPicker = useCallback(() => {
    if (!countrySelectable || !editable) return;
    setPickerOpen(true);
    optionsRef.current.onModalOpen?.();
  }, [countrySelectable, editable]);

  const closePicker = useCallback(() => {
    setPickerOpen((open) => {
      if (open) optionsRef.current.onModalClose?.();
      return false;
    });
  }, []);

  const pushRecent = useCallback(
    (code: CountryCode) => {
      setRecents((prev) => {
        const next = [code, ...prev.filter((c) => c !== code)].slice(
          0,
          maxRecents
        );
        if (next.join() !== prev.join())
          optionsRef.current.onRecentsChange?.(next);
        return next;
      });
    },
    [maxRecents]
  );

  const setCountry = useCallback(
    (code: CountryCode) => {
      if (!isSupportedCountryCode(code)) return;
      const nextText =
        clearOnCountryChange && code !== countryRef.current
          ? ''
          : reformatForCountry(textRef.current, code);
      applyCountry(code, true);
      applyText(nextText);
      setSelection(undefined);
      emitChange(nextText, code);
    },
    [clearOnCountryChange, applyCountry, applyText, emitChange]
  );

  const selectCountry = useCallback(
    (code: CountryCode) => {
      closePicker();
      pushRecent(code);
      setCountry(code);
    },
    [closePicker, pushRecent, setCountry]
  );

  const getValue = useCallback(
    () =>
      buildValue(
        textRef.current,
        countryRef.current,
        interactionRef.current,
        serverError ?? optionsRef.current.error
      ).value,
    [buildValue, serverError]
  );

  const validate = useCallback(() => {
    interactionRef.current = {
      ...interactionRef.current,
      submitted: true,
      touched: true,
    };
    setInteraction(interactionRef.current);
    const result = buildValue(
      textRef.current,
      countryRef.current,
      interactionRef.current,
      serverError ?? optionsRef.current.error
    ).value;
    // `validate()` always reports the message, even if not displayed before.
    if (!result.isValid && !result.errorMessage && result.error) {
      return {
        ...result,
        errorMessage: getErrorMessage(result.error, {
          country: result.country,
          allowedNumberTypes: optionsRef.current.allowedNumberTypes,
          locale: optionsRef.current.locale,
          messages: optionsRef.current.messages,
          countryNameOverrides: optionsRef.current.countryNameOverrides,
        }),
      };
    }
    return result;
  }, [buildValue, serverError]);

  const setValue = useCallback(
    (next: string, nextCountry?: CountryCode) => {
      const base =
        nextCountry && isSupportedCountryCode(nextCountry)
          ? nextCountry
          : countryRef.current;
      const parsed = parseExternalValue(next, base, inputOptions);
      applyCountry(parsed.country, true);
      applyText(parsed.text);
      setSelection(undefined);
      emitChange(parsed.text, parsed.country);
    },
    [inputOptions, applyCountry, applyText, emitChange]
  );

  const clear = useCallback(() => {
    applyText('');
    setServerError(null);
    setSelection(undefined);
    interactionRef.current = {
      focused: interactionRef.current.focused,
      touched: false,
      dirty: false,
      submitted: false,
    };
    setInteraction(interactionRef.current);
    emitChange('', countryRef.current);
  }, [applyText, emitChange]);

  const focus = useCallback(() => inputRef.current?.focus(), []);
  const blur = useCallback(() => inputRef.current?.blur(), []);

  return {
    text,
    country,
    value: { ...value, state },
    state,
    error: value.error,
    errorMessage: errorVisible ? value.errorMessage : null,
    errorVisible,
    externalErrorMessage:
      typeof externalError === 'string' && externalError ? externalError : null,
    isValid,
    isFocused: interaction.focused,
    placeholder,
    messages,
    editable,
    countrySelectable,
    isPickerOpen,
    openPicker,
    closePicker,
    selectCountry,
    countries,
    preferredCountries,
    recentCountries,
    inputRef,
    onChangeText,
    onFocus,
    onBlur,
    onSelectionChange,
    selection,
    validate,
    getValue,
    setValue,
    setCountry,
    setError: setServerError,
    clear,
    focus,
    blur,
  };
}
