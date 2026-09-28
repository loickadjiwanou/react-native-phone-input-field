/** Everything public, without metadata registration (see index.ts / min.ts). */
export * from './core/api';
export * from './components';
export {
  computeDisplayState,
  type DisplayInput,
  usePhoneField,
  type PhoneFieldController,
  type ShowIncompleteAsError,
  type UsePhoneFieldOptions,
  type ValidateOn,
} from './hooks/usePhoneField';
export {
  useCountrySearch,
  type UseCountrySearchResult,
} from './hooks/useCountrySearch';
export {
  getDeviceCountry,
  resolveDefaultCountry,
  useDefaultCountry,
  type DefaultCountryOptions,
} from './hooks/useDefaultCountry';
export * from './theme';
export { en, fr } from './i18n';
export type {
  InputFocusEvent,
  InputSelectionChangeEvent,
  TextInputRef,
  ViewRef,
} from './types';
