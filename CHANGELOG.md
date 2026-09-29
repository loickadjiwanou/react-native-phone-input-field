# react-native-phone-input-field

## 0.2.0

### Minor Changes

- Add a `lang` prop (`'fr' | 'en'`) to `<PhoneField />` and `usePhoneField`. It sets the language of the country picker modal, the country names, the error messages and the accessibility labels in one go. It is a typed shortcut for `locale` and wins over it (and over the `PhoneFieldThemeProvider` locale). The `PhoneFieldLang` type is exported.

## 0.1.0

### Minor Changes

- First release.
  - `<PhoneField />`: flag, chevron, calling code and as-you-type formatting. Real-time validation turns the border red as soon as a number is certainly wrong and green when it is valid. Validation message, valid message, status icon, shake on error and focus color are opt-in (`showErrorMessage`, `showValidMessage`, `showStatusIcon`, `animateOnError`, `highlightOnFocus`). Three variants and three sizes.
  - `<CountryPickerModal />`: bottom sheet / full screen / centered card with `react-native-modal`-style animations on the native driver (`modalProps`). Accent-insensitive search (name, ISO code, calling code, aliases), suggested and recent countries, sticky A–Z sections, alphabet index, swipe to close. Opens on the selected country without flashing and keeps the Android navigation bar untouched.
  - `usePhoneField`: headless hook with the whole behaviour.
  - Pure API (`validatePhoneNumber`, `isValidPhoneNumber`, `formatPhoneNumber`, `detectCountryFromNumber`…), usable in Node via `react-native-phone-input-field/core`.
  - `customRules` layer on top of libphonenumber-js, with the legacy Beninese operator rule available as the opt-in `BJ_OPERATOR_RULE`.
  - `zPhone` Zod helper (`react-native-phone-input-field/zod`), a lighter `react-native-phone-input-field/min` entry, light / dark themes, FR / EN, RTL, screen reader support.
  - Fixes every bug of the legacy `international-phone-numbers.js` (regression tests included); `DEFAULT_EXCLUDED_COUNTRIES` is its `EXCLUDED_COUNTRIES` list.
