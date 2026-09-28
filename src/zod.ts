import { z } from 'zod';

import './core/setupMax';
import { validatePhoneNumber, type ValidationOptions } from './core/validation';
import type { CountryCode } from './types';

export interface ZodPhoneOptions extends ValidationOptions {
  /** Country used for national numbers. International numbers are detected. */
  country?: CountryCode;
  /** Error message; defaults to the translated validation message. */
  message?: string;
  /** Output: `'e164'` (default) transforms to E.164, `'input'` keeps the input. */
  output?: 'e164' | 'input';
}

/**
 * Zod schema for a phone number. By default it outputs the E.164 form, which
 * is what you should store.
 *
 * @example
 * import { zPhone } from 'react-native-phone-input-field/zod';
 * const schema = z.object({ phone: zPhone({ country: 'BJ', allowedNumberTypes: ['MOBILE'] }) });
 * schema.parse({ phone: '01 97 12 34 56' }); // { phone: '+2290197123456' }
 */
export function zPhone(options: ZodPhoneOptions = {}) {
  const { country, message, output = 'e164', ...validation } = options;
  return z.string().transform((input, ctx) => {
    const result = validatePhoneNumber(input, country, {
      required: true,
      ...validation,
    });
    if (!result.isValid) {
      ctx.addIssue({
        code: 'custom',
        message: message ?? result.errorMessage ?? 'Invalid phone number',
        params: { phoneError: result.error },
      });
      return z.NEVER;
    }
    return output === 'e164' ? (result.e164 as string) : input;
  });
}
