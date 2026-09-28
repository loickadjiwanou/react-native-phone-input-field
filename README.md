# react-native-phone-input-field

International phone number input for React Native: country picker, as-you-type formatting and **real-time validation** powered by [libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js) (Google's metadata).

```
┌──────────────────────────────────────────────────────┐
│ 🇧🇯 ▾  +229 │ 01 97 12 34 56                         │  ← green border: valid
└──────────────────────────────────────────────────────┘
```

- **Pure TypeScript, no native code.** Works in Expo Go, Expo dev clients and React Native CLI (iOS, Android). Web is supported through react-native-web.
- **Border feedback while typing**: red as soon as the number is certainly wrong, green when it is valid, neutral otherwise (never red on a number that is simply not finished yet). Messages, status icon, shake and focus color are opt-in.
- **Imperative validation for submit buttons**: `ref.current.validate()` turns the border red when the number is wrong (optionally shaking the field) and returns the E.164 number.
- **Ultra customizable**: theme tokens, a style prop for every part, render props for every visual element, your own bottom sheet, or a headless hook.
- **Offline**: flags (emoji), country names (CLDR) and metadata are bundled. No network request at runtime.
- FR / EN built in, dark mode, RTL, screen reader support.

> To see it live, run the example app (`yarn example start`, see [Example app](#example-app)).

---

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Validating on submit](#validating-on-submit)
- [How validation behaves](#how-validation-behaves)
- [Props](#props)
- [Ref API](#ref-api)
- [`PhoneValue`](#phonevalue)
- [Pure functions (also in Node)](#pure-functions-also-in-node)
- [Headless hook](#headless-hook)
- [Theming](#theming)
- [i18n](#i18n)
- [Custom rules](#custom-rules)
- [Forms: react-hook-form, Formik, Zod](#forms-react-hook-form-formik-zod)
- [Accessibility](#accessibility)
- [Bundle size](#bundle-size)
- [FAQ](#faq)
- [Migrating from `international-phone-numbers.js`](#migrating-from-international-phone-numbersjs)
- [Example app](#example-app)
- [Contributing](#contributing)

---

## Installation

```sh
npm install react-native-phone-input-field
# or
yarn add react-native-phone-input-field
# or
pnpm add react-native-phone-input-field
# Expo
npx expo install react-native-phone-input-field
```

Peer dependencies: `react >= 18`, `react-native >= 0.72`. The only dependency is `libphonenumber-js`.

Optional, detected automatically when installed (nothing breaks when they are not):

| Package | Used for |
|---|---|
| `expo-localization` | Default country from the device region |
| `react-native-safe-area-context` | Exact safe-area insets in the country picker (mount a `SafeAreaProvider`) |
| `zod` | `zPhone()` from `react-native-phone-input-field/zod` |

## Quick start

```tsx
import { PhoneField } from 'react-native-phone-input-field';

export function Screen() {
  return (
    <PhoneField
      label="Téléphone"
      defaultCountry="BJ"
      preferredCountries={['BJ', 'TG', 'CI', 'SN', 'NG', 'FR']}
      onChangePhone={(v) => console.log(v.e164, v.isValid)}
    />
  );
}
```

## Validating on submit

```tsx
import { useRef, useState } from 'react';
import { Button } from 'react-native';
import { PhoneField, type PhoneFieldRef } from 'react-native-phone-input-field';

const phoneRef = useRef<PhoneFieldRef>(null);
const [valid, setValid] = useState(false);

<PhoneField
  ref={phoneRef}
  defaultCountry="BJ"
  preferredCountries={['BJ', 'TG', 'CI', 'SN', 'NG', 'FR']}
  allowedNumberTypes={['MOBILE']}
  onValidityChange={setValid}
  required
/>

<Button
  title="Continuer"
  disabled={!valid}
  onPress={() => {
    const res = phoneRef.current!.validate(); // red border if wrong (+ shake with animateOnError)
    if (!res.isValid) return;
    api.sendOtp(res.e164); // always send E.164 to your backend
  }}
/>
```

Server said no? Show it on the field; it disappears as soon as the user edits the number:

```ts
phoneRef.current?.setError('Ce numéro est déjà utilisé');
```

## How validation behaves

| State | When | Border (default) |
|---|---|---|
| `idle` | empty, not focused | `colors.border` |
| `focused` | focused, nothing to report yet | `colors.border` (`colors.primary` with `highlightOnFocus`) |
| `incomplete` | plausible but too short | neutral while typing, **`error` after blur or submit** |
| `invalid` | too long, impossible prefix, wrong type, excluded country, custom rule | **`error` immediately, even while typing** |
| `valid` | valid for the country, the allowed types and your rules | `colors.success` |
| `disabled` | `editable={false}` | `colors.disabled`, reduced opacity |

"Certainly wrong" is decided character by character. The package compiles libphonenumber's patterns into a small automaton that answers *"can these digits still become a valid number?"*. Examples: typing `9` in Benin (the 8-digit plan is gone), `01` in France with `allowedNumberTypes={['MOBILE']}`, or `+999`.

Tune it with:

- `validateOn`: `'change'` (default), `'blur'` or `'submit'`, i.e. when red / green feedback starts;
- `showIncompleteAsError`: `'never'`, `'onBlur'` (default) or `'always'`;
- `errorDebounceMs` (default `0`): delay before the red appears while typing.

By default the border color is the only visual signal; screen readers still get the message (`accessibilityHint`) and an announcement. For WCAG 1.4.1 ("color is not the only signal"), turn on `showErrorMessage` and/or `showStatusIcon`.

## Props

All props are optional and documented in JSDoc (hover them in your editor).

### Value

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | | Controlled value: E.164 (`+2290197123456`), international with spaces, or national digits for `country`. |
| `defaultValue` | `string` | | Initial value (uncontrolled), same formats. |
| `onChangePhone` | `(v: PhoneValue) => void` | | Every change, with the full [`PhoneValue`](#phonevalue). |
| `onChangeText` | `(text: string) => void` | | Every change, with the displayed text (`01 97 12 34 56`). |
| `onValidityChange` | `(isValid, v) => void` | | Only when validity flips (and once on mount if the initial value is valid). |

### Country

| Prop | Type | Default | Description |
|---|---|---|---|
| `country` | `CountryCode` | | Controlled country. |
| `defaultCountry` | `CountryCode` | device region, then `fallbackCountry` | Initial country. |
| `fallbackCountry` | `CountryCode` | `'BJ'` | Last resort when the device region is unknown. |
| `onCountryChange` | `(c: Country) => void` | | Picker selection, `+xxx` detection, `setCountry`. |
| `preferredCountries` | `CountryCode[]` | | Pinned at the top of the picker ("Pays suggérés"). |
| `onlyCountries` | `CountryCode[]` | | Only these countries are listed and accepted. |
| `excludedCountries` | `CountryCode[]` | `DEFAULT_EXCLUDED_COUNTRIES` | Hidden and rejected (`COUNTRY_NOT_ALLOWED`). Pass `[]` to show everything. |
| `autoDetectCountry` | `boolean` | `true` | Switch country when `+xxx` / `00xxx` is typed, pasted or autofilled. |
| `countrySelectable` | `boolean` | `true` | `false` freezes the country (no picker, no chevron, no auto-detection). |
| `clearOnCountryChange` | `boolean` | `false` | Clear the number when another country is picked (otherwise it is re-formatted and re-validated). |
| `recentCountries` | `CountryCode[]` | | Initial "Récents" (e.g. restored from storage). |
| `onRecentsChange` | `(codes) => void` | | Persist recents yourself (AsyncStorage, MMKV…). |
| `maxRecents` | `number` | `5` | |

### Validation

| Prop | Type | Default | Description |
|---|---|---|---|
| `required` | `boolean` | `false` | Empty is an error (`REQUIRED`), shown on submit, or on blur after the user typed and erased. |
| `validateOn` | `'change' \| 'blur' \| 'submit'` | `'change'` | When feedback starts. |
| `showIncompleteAsError` | `'never' \| 'onBlur' \| 'always'` | `'onBlur'` | When a too-short number turns red. |
| `errorDebounceMs` | `number` | `0` | Delay before showing an error while typing. |
| `allowedNumberTypes` | `NumberType[]` | | e.g. `['MOBILE']` for SMS OTP. Wrong type → `WRONG_TYPE`. |
| `customRules` | `Partial<Record<CountryCode, CustomRule>>` | | Business rules on top of libphonenumber, see [Custom rules](#custom-rules). |
| `customValidator` | `(v) => PhoneValidationError \| string \| null` | | Extra synchronous check once the number is otherwise valid. Return a code, a message or `null`. |
| `error` | `string \| boolean` | | Error forced from outside (server). |
| `limitMaxLength` | `boolean` | `true` | Refuse digits beyond the country's maximum length. `false` lets users see `TOO_LONG`. |

### UI

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | | Label above the field (`*` added when `required`). |
| `placeholder` | `string` | example mobile, masked (`01 •• •• •• ••`) | |
| `helperText` | `string` | | Text under the field when there is no error. |
| `showErrorMessage` | `boolean` | `false` | Validation message under the field ("Numéro invalide pour Bénin"). By default only the border color changes; server errors (`setError`, `error="…"`) are always shown. |
| `showValidMessage` | `boolean` | `false` | "Numéro valide · Mobile" under a valid number. |
| `showFlag` / `showChevron` / `showCallingCode` | `boolean` | `true` / `countrySelectable` / `true` | Parts of the country zone. |
| `showStatusIcon` | `boolean` | `false` | ✓ / ! on the right. |
| `clearable` | `boolean` | `false` | Clear button inside the field. |
| `animateOnError` | `boolean` | `false` | Shake when `validate()` fails (`ref.shake()` always works). |
| `highlightOnFocus` | `boolean` | `false` | Primary-colored border while focused. By default the border only turns green (valid) or red (error). |
| `editable` | `boolean` | `true` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `variant` | `'outlined' \| 'filled' \| 'underlined'` | `'outlined'` | |
| `flagSize` | `number` | per size | |
| `theme` | `DeepPartial<PhoneFieldTheme>` | | See [Theming](#theming). |
| `colors` | `Partial<ThemeColors>` | | Shortcut, e.g. `colors={{ error: '#E11D48' }}`. |
| `colorScheme` | `'auto' \| 'light' \| 'dark'` | `'auto'` | |

### Styles

`containerStyle` (label + field + helper), `fieldStyle` (bordered box), `containerStyleByState` (`{ invalid: {...}, valid: {...} }`; `invalid` also applies whenever an error is visible), `inputStyle`, `labelStyle`, `countryTriggerStyle`, `flagStyle`, `chevronStyle`, `callingCodeStyle`, `helperTextStyle`, `errorTextStyle`, `modalStyles` (`backdrop`, `container`, `header`, `handle`, `title`, `closeButton`, `closeIcon`, `searchContainer`, `searchInput`, `list`, `listContent`, `sectionHeader`, `sectionHeaderText`, `item`, `itemSelected`, `itemName`, `itemCallingCode`, `empty`, `emptyText`, `alphabetIndex`, `alphabetLetter`).

### Render props

| Prop | Signature |
|---|---|
| `renderFlag` | `(iso2, size) => ReactNode`: images, SVG… (used in the field and the picker) |
| `renderChevron` | `(open) => ReactNode` |
| `renderStatusIcon` | `(state, errorVisible) => ReactNode` |
| `renderLeft` / `renderRight` | `(field: PhoneFieldController) => ReactNode` |
| `renderCountryItem` | `({ country, selected, onSelect, height }) => ReactNode` (keep `height`: the list uses fixed row heights) |
| `renderSearchBar` | `({ value, onChangeText, placeholder }) => ReactNode` |
| `renderModalHeader` | `({ title, onClose }) => ReactNode` |
| `renderEmpty` | `(query) => ReactNode` |
| `renderModal` | `({ visible, onClose, countries, onSelect, selected, preferredCountries, recentCountries, messages, theme }) => ReactNode`: plug `@gorhom/bottom-sheet` or anything else |

### Country picker

| Prop | Type | Default | Description |
|---|---|---|---|
| `modalPresentation` | `'bottomSheet' \| 'fullScreen' \| 'center'` | `'bottomSheet'` | Bottom sheet ≈ 90% of the screen, swipe down to close. |
| `modalTitle` / `searchPlaceholder` | `string` | translated | |
| `autoFocusSearch` | `boolean` | `false` | |
| `showAlphabetIndex` | `boolean` | `false` | A–Z strip, tap or drag to jump. |
| `closeOnBackdropPress` | `boolean` | `true` | Android back button always closes. |
| `refocusAfterSelect` | `boolean` | `true` | Focus the input again after picking. |
| `modalProps` | `ModalAnimationProps` | see below | Open / close animation, `react-native-modal` style. |
| `onModalOpen` / `onModalClose` | `() => void` | | |

**`modalProps`**: same names and meaning as `react-native-modal`, with no dependency (everything runs on the native driver):

```tsx
<PhoneField
  modalProps={{
    animationIn: 'fadeInUp',          // 'fadeInUp' | 'slideInUp' | 'fadeIn' | 'zoomIn'
    animationOut: 'fadeOutDown',      // 'fadeOutDown' | 'slideOutDown' | 'fadeOut' | 'zoomOut'
    animationInTiming: 450,         // decelerating curve, starts when the modal is on screen
    animationOutTiming: 300,
    backdropTransitionInTiming: 450,
    backdropTransitionOutTiming: 300,
    backdropOpacity: 0.4,             // opacity of colors.overlay
    onBackdropPress: () => {},        // called before closing (closeOnBackdropPress)
    hideModalContentWhileAnimating: true, // list mounted after the opening animation
    swipeToClose: true,
  }}
/>
```

The values above are the defaults. To use `react-native-modal` itself, pass `renderModal`.

### Misc

| Prop | Type | Description |
|---|---|---|
| `onValidHaptic` | `() => void` | Called when the number becomes valid. Plug `expo-haptics` or anything, no dependency. |
| `announceValidation` | `boolean` (default `true`) | Screen reader announcements. |
| `onFocus` / `onBlur` | `(e) => void` | |
| `locale` / `messages` / `countryNameOverrides` | | See [i18n](#i18n). |
| `inputProps` | `TextInputProps` | Passed to the `TextInput` (`value`, `onChangeText`, `onFocus` and `onBlur` are managed). |
| `testID` | `string` | Default `phone-field`. Children: `-input`, `-container`, `-country-trigger`, `-error`, `-helper`, `-clear`. |
| `accessibilityLabel` | `string` | Input label for screen readers (defaults to `label`). |

## Ref API

| Method | Description |
|---|---|
| `validate(): PhoneValue` | Shows errors (even `incomplete`), shakes on error with `animateOnError`, returns the value. |
| `isValid(): boolean` | |
| `getValue(): PhoneValue` | |
| `setValue(value, country?)` | E.164, international, or national digits for `country`. |
| `setCountry(country)` | Re-formats the typed number. |
| `setError(message \| null)` | Server error; cleared when the user edits. |
| `clear()`, `focus()`, `blur()` | |
| `openCountryPicker()`, `closeCountryPicker()` | |
| `shake()` | |

## `PhoneValue`

```ts
interface PhoneValue {
  raw: string;           // what the user sees: "01 97 12 34 56"
  national: string;      // "01 97 12 34 56"
  international: string; // "+229 01 97 12 34 56"
  e164: string | null;   // "+2290197123456", null until the number has a possible length
  country: CountryCode;  // "BJ" (may have been detected)
  callingCode: string;   // "229"
  isValid: boolean;
  isPossible: boolean;
  type?: NumberType;     // "MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE"…
  state: 'idle' | 'focused' | 'incomplete' | 'invalid' | 'valid' | 'disabled';
  error: PhoneValidationError | null;
  errorMessage: string | null; // translated
}

type PhoneValidationError =
  | 'REQUIRED' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_COUNTRY' | 'INVALID_NUMBER'
  | 'NOT_A_NUMBER' | 'WRONG_TYPE' | 'COUNTRY_NOT_ALLOWED' | 'CUSTOM_RULE';
```

## Pure functions (also in Node)

```ts
import {
  validatePhoneNumber,
  isValidPhoneNumber,
  formatPhoneNumber,
  detectCountryFromNumber,
  getCountries,
  getCountry,
  getExampleNumber,
} from 'react-native-phone-input-field/core'; // no React, no React Native: works on your server

validatePhoneNumber('+2290197123456');          // { isValid: true, e164: '+2290197123456', type: 'MOBILE', … }
validatePhoneNumber('06 12 34 56 78', 'FR');    // { isValid: true, e164: '+33612345678', … }
validatePhoneNumber('0142685300', 'FR', { allowedNumberTypes: ['MOBILE'] }).error; // 'WRONG_TYPE'
isValidPhoneNumber('+14165551234', 'CA');       // true
formatPhoneNumber('0197123456', 'BJ', 'INTERNATIONAL'); // '+229 01 97 12 34 56'
detectCountryFromNumber('00229 01 97 12 34 56'); // 'BJ'
detectCountryFromNumber('+7 701 123 4567');      // 'KZ' (shared +7 resolved)
getCountries('fr');                              // [{ iso2, callingCode, name, englishName, flag }, …]
getCountry('BJ', 'en');                          // { iso2: 'BJ', callingCode: '229', name: 'Benin', … }
getExampleNumber('BJ');                          // '01 95 12 34 56'
```

The same functions are exported from the main entry. Options (`ValidationOptions`): `required`, `allowedNumberTypes`, `customRules`, `customValidator`, `onlyCountries`, `excludedCountries` (none by default in pure functions), `autoDetectCountry`, `locale`, `messages`, `countryNameOverrides`.

## Headless hook

`<PhoneField />` is built on `usePhoneField`, so the hook has every behaviour: state, formatting, caret handling, detection, validation, picker state and the imperative API.

```tsx
import { TextInput } from 'react-native';
import { usePhoneField } from 'react-native-phone-input-field';

function MyPhoneInput() {
  const field = usePhoneField({ defaultCountry: 'BJ', required: true });
  return (
    <>
      <Text onPress={field.openPicker}>{field.country.flag} +{field.country.callingCode}</Text>
      <TextInput
        ref={field.inputRef}
        value={field.text}
        onChangeText={field.onChangeText}
        onFocus={field.onFocus}
        onBlur={field.onBlur}
        onSelectionChange={field.onSelectionChange}
        selection={field.selection}
        placeholder={field.placeholder}
        keyboardType="phone-pad"
        style={{ borderColor: field.errorVisible ? 'red' : field.state === 'valid' ? 'green' : 'gray' }}
      />
      {field.errorMessage ? <Text>{field.errorMessage}</Text> : null}
    </>
  );
}
```

Also exported: `useCountrySearch(countries)`, `useDefaultCountry()`, `computeDisplayState()`, and every sub-component (`CountryPickerModal`, `CountryTrigger`, `CountryListItem`, `SearchBar`, `Flag`, `StatusIcon`, `HelperText`).

## Theming

```tsx
<PhoneField
  colors={{ primary: '#7C3AED', error: '#E11D48' }}
  theme={{ radius: { field: 0 }, borderWidth: { focus: 3 }, fontFamily: { regular: 'Inter' } }}
  containerStyleByState={{ valid: { backgroundColor: '#F0FDF4' } }}
/>
```

Tokens (`PhoneFieldTheme`): `colors` (`primary`, `border`, `error`, `success`, `text`, `textSecondary`, `placeholder`, `background`, `surface`, `disabled`, `overlay`, `highlight`, `separator`), `radius`, `spacing`, `fontFamily`, `fontSizes`, `borderWidth` (`normal`, `focus`), `sizes` (`sm` / `md` / `lg`), `countryItemHeight`, `animationDuration`.

`defaultTheme` and `darkTheme` meet WCAG AA contrast (this is checked by tests). The dark theme follows `useColorScheme()` unless you set `colorScheme`.

App-wide configuration:

```tsx
import { PhoneFieldThemeProvider } from 'react-native-phone-input-field';

<PhoneFieldThemeProvider
  theme={{ colors: { primary: '#7C3AED' } }}
  darkTheme={{ colors: { primary: '#C4B5FD' } }}
  colorScheme="auto"
  locale="en"
>
  <App />
</PhoneFieldThemeProvider>
```

## i18n

French (default) and English are included, for the UI and the error messages. Any other `locale` uses English texts. Country names come from `Intl.DisplayNames` when the JS engine has it, and from embedded CLDR tables (FR / EN) otherwise, so Hermes without `DisplayNames` is fine.

```tsx
<PhoneField
  locale="en"
  messages={{
    modalTitle: 'Pick a country',
    errors: { TOO_SHORT: 'A few digits are missing ({country})' },
  }}
  countryNameOverrides={{ CD: 'RDC', GB: 'Angleterre' }}
/>
```

Default French messages:

| Code | Message |
|---|---|
| `REQUIRED` | Le numéro de téléphone est requis |
| `TOO_SHORT` | Numéro trop court pour {country} |
| `TOO_LONG` | Numéro trop long pour {country} |
| `INVALID_COUNTRY` | Indicatif pays invalide |
| `INVALID_NUMBER` | Numéro invalide pour {country} |
| `NOT_A_NUMBER` | Ceci n’est pas un numéro de téléphone |
| `WRONG_TYPE` | Veuillez saisir un numéro {types} (e.g. "mobile", "mobile ou fixe") |
| `COUNTRY_NOT_ALLOWED` | Les numéros de ce pays ({country}) ne sont pas acceptés |
| `CUSTOM_RULE` | Ce numéro n’est pas accepté pour {country} (or your rule's `message`) |

Placeholders: `{country}`, `{callingCode}`, `{types}`.

**RTL**: the layout uses start / end, so it mirrors with `I18nManager` (or a `direction: 'rtl'` parent). The country zone stays at the start of the line and digits stay left-to-right.

## Custom rules

libphonenumber knows every numbering plan. Custom rules add **your business constraints on top**: both must accept the number. With `mode: 'override'`, the rule replaces libphonenumber for that country.

```ts
interface CustomRule {
  pattern?: RegExp;         // tested on the NATIONAL SIGNIFICANT NUMBER
  nationalPattern?: RegExp; // tested on the NATIONAL NUMBER (with trunk prefix)
  lengths?: number[];       // allowed NSN lengths
  message?: string;         // error message
  description?: string;
  mode?: 'extend' | 'override'; // default 'extend'
}
```

**National significant number vs national number**: this difference is what broke the legacy file.

| | France | Bénin |
|---|---|---|
| E.164 | `+33612345678` | `+2290197123456` |
| National **significant** number (NSN): after the calling code, no trunk prefix | `612345678` | `0197123456` (the `01` belongs to the number since 2024) |
| National number: what people dial locally | `0612345678` | `0197123456` |

Patterns are anchored automatically (whole-string match). While the user types, the package also checks that the digits can still satisfy your pattern and turns red early when they cannot.

```tsx
import { BJ_OPERATOR_RULE, createPrefixRule } from 'react-native-phone-input-field';

// Opt-in example: Beninese mobiles from known operators only.
// ⚠️ Operator ranges change: check them against ARCEP Bénin before shipping.
<PhoneField customRules={{ BJ: BJ_OPERATOR_RULE }} />

// Only one operator's blocks:
const mtnOnly = createPrefixRule({
  prefixes: ['0196', '0197', '0161', '0162'],
  lengths: [10],
  message: 'Seuls les numéros MTN sont acceptés',
});
<PhoneField customRules={{ BJ: mtnOnly }} />
```

## Forms: react-hook-form, Formik, Zod

### react-hook-form

```tsx
import { Controller, useForm } from 'react-hook-form';
import { PhoneField, isValidPhoneNumber } from 'react-native-phone-input-field';

const { control, handleSubmit } = useForm({ defaultValues: { phone: '' }, mode: 'onChange' });

<Controller
  control={control}
  name="phone"
  rules={{ validate: (v) => isValidPhoneNumber(v) || 'Numéro invalide' }}
  render={({ field, fieldState }) => (
    <PhoneField
      defaultCountry="BJ"
      value={field.value}
      // E.164 once possible, international format while typing: it round-trips.
      onChangePhone={(v) => field.onChange(v.e164 ?? v.international)}
      onBlur={field.onBlur}
      error={fieldState.isTouched ? fieldState.error?.message : undefined}
    />
  )}
/>
```

### Zod

`zod` is an optional peer dependency. `zPhone` validates with the same engine and **outputs E.164**:

```ts
import { z } from 'zod';
import { zPhone } from 'react-native-phone-input-field/zod';

const schema = z.object({
  phone: zPhone({ country: 'BJ', allowedNumberTypes: ['MOBILE'] }),
});
schema.parse({ phone: '01 97 12 34 56' }); // { phone: '+2290197123456' }
```

Use it with `@hookform/resolvers/zod` as usual. Options: every `ValidationOptions`, plus `country`, `message` and `output: 'e164' | 'input'`.

### Formik

```tsx
import { Formik } from 'formik';
import { PhoneField, validatePhoneNumber } from 'react-native-phone-input-field';

<Formik
  initialValues={{ phone: '' }}
  validate={({ phone }) => {
    const res = validatePhoneNumber(phone, undefined, { required: true });
    return res.isValid ? {} : { phone: res.errorMessage ?? 'Numéro invalide' };
  }}
  onSubmit={({ phone }) => api.save(phone)}
>
  {({ values, errors, touched, setFieldValue, setFieldTouched, handleSubmit }) => (
    <>
      <PhoneField
        defaultCountry="BJ"
        value={values.phone}
        onChangePhone={(v) => setFieldValue('phone', v.e164 ?? v.international)}
        onBlur={() => setFieldTouched('phone')}
        error={touched.phone ? errors.phone : undefined}
      />
      <Button title="Envoyer" onPress={() => handleSubmit()} />
    </>
  )}
</Formik>
```

## Accessibility

- The country button has `accessibilityRole="button"`, the label "Pays sélectionné : Bénin, +229" and `accessibilityState={{ expanded }}`.
- The input announces its error through `accessibilityHint`; validity changes are announced with `AccessibilityInfo.announceForAccessibility` (`announceValidation`).
- By default only the border color changes; enable `showErrorMessage` / `showStatusIcon` so color is not the only visual signal (WCAG 1.4.1).
- Picker rows are at least 48 dp high, section headers are headers, the modal traps focus (`accessibilityViewIsModal`).
- Dynamic font sizes are supported (`allowFontScaling`); row heights follow the font scale.
- Both themes meet WCAG AA contrast.

## Bundle size

Approximate, minified + gzip:

| Part | Size |
|---|---|
| Library code (components, hook, engine) | ≈ 24 kB |
| Country names FR + EN (CLDR) | ≈ 3.5 kB |
| libphonenumber **max** metadata (default entry) | ≈ 40 kB |
| libphonenumber **min** metadata (`/min` entry) | ≈ 20 kB |

```ts
// Same API, lighter metadata. Number types are not available:
// allowedNumberTypes is ignored and PhoneValue.type is undefined.
import { PhoneField } from 'react-native-phone-input-field/min';
```

## FAQ

**Why always store E.164?**
`+2290197123456` is unique, has no ambiguity (no trunk prefix, no spaces, no local habits) and is what SMS providers (Twilio, Vonage, Africa's Talking…) and databases expect. Format it for display with `formatPhoneNumber` or `toNational`.

**How do I update the metadata?**
Numbering plans change (Benin moved to 10 digits in 2024). The metadata comes from `libphonenumber-js`, so update it: `yarn up libphonenumber-js` (or `npm update libphonenumber-js`) in your app. No release of this package is needed.

**Mobile or landline?**
With the default (max) metadata, `PhoneValue.type` tells you. Some countries do not distinguish them (US, CA → `FIXED_LINE_OR_MOBILE`); those numbers pass both `MOBILE` and `FIXED_LINE`. For SMS, use `allowedNumberTypes={['MOBILE']}`.

**Does it work in Expo Go?**
Yes: no native module, and optional packages are detected at runtime.

**Can users paste `+33 6 12…` or `0033…`?**
Yes, and iOS / Android autofill too. The country switches, the calling code leaves the input and the rest is formatted. `+1`, `+7`, `+44`, `+262`, `+590` and `+599` are shared by several countries; the right one is picked from the digits (`+1 416…` → Canada).

**The caret jumps when I edit in the middle.**
It should not: the field keeps the caret after the same digit. Backspace on a space deletes the digit before it. If you use the headless hook, pass `selection` and `onSelectionChange` to your `TextInput`.

## Migrating from `international-phone-numbers.js`

| Legacy | Now |
|---|---|
| `isValid(number)` | `isValidPhoneNumber(number)`. With a national number, pass the country: `isValidPhoneNumber('0197123456', 'BJ')` |
| `COUNTRIES` (regex per country) | libphonenumber metadata. Keep business constraints in `customRules` |
| `CALLING_CODE_PER_COUNTRY_CODE` | `getCountry(iso2).callingCode`, `detectCountryFromNumber(number)` |
| `MASK_PER_COUNTRY` | nothing to maintain: `AsYouType` formatting (`formatPhoneNumber`) |
| `EXCLUDED_COUNTRIES` | `excludedCountries` prop; `DEFAULT_EXCLUDED_COUNTRIES` is the same list |
| custom `BJ` rule | `BJ_OPERATOR_RULE`: same regex, opt-in (`customRules={{ BJ: BJ_OPERATOR_RULE }}`), or `createPrefixRule` |

Behaviour changes you will notice, all fixes:

- France, the UK, Germany, Japan, Australia and 31 other countries validate again. Their legacy regexes included the trunk `0` that `totalDigits` did not count.
- International numbers are no longer required to contain the trunk `0` (`+234 803…` is valid).
- Morocco, Kazakhstan, Finland, Canada, Australia and New Zealand are detected.
- `+1`, `+7`, `+61`, `+262` and `+590` resolve to the right country.
- Mobile / fixed is explicit (`type`, `allowedNumberTypes`).

If you had a regex written against the national number *with* the `0`, move it to `nationalPattern`. If it was written against digits after the calling code, use `pattern`.

## Example app

```sh
yarn install
yarn example start   # then i / a / w
```

Five demos: basic field with a "Vérifier" button and the `PhoneValue` JSON; sign-up form (react-hook-form + Zod, disabled submit, "number already used" server error); mobile-only OTP for West Africa; ultra-custom (underlined, image flags, full-screen picker, brand theme); headless UI. The header switches light / dark, FR / EN and RTL.

## Contributing

```sh
yarn install
yarn typecheck && yarn lint && yarn test && yarn build
yarn changeset   # describe your change for the changelog
```

Country names are generated from CLDR with `yarn generate:country-names`.

## License

MIT
