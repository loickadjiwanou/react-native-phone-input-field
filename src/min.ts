/**
 * Same API as `react-native-phone-input-field`, with libphonenumber's **min**
 * metadata: smaller bundle, but no number types (`allowedNumberTypes` is
 * ignored and `PhoneValue.type` is always `undefined`).
 */
import './core/setupMin';

export * from './exports';
