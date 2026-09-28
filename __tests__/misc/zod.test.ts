import { z } from 'zod';

import { zPhone } from 'react-native-phone-input-field/zod';

describe('zPhone', () => {
  it('outputs E.164 for valid numbers', () => {
    const schema = z.object({ phone: zPhone({ country: 'BJ' }) });
    expect(schema.parse({ phone: '01 97 12 34 56' })).toEqual({
      phone: '+2290197123456',
    });
    expect(zPhone().parse('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('can keep the input', () => {
    expect(zPhone({ country: 'BJ', output: 'input' }).parse('0197123456')).toBe(
      '0197123456'
    );
  });

  it('reports the translated error, or a custom message', () => {
    const result = zPhone({ country: 'BJ' }).safeParse('0197');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      'Numéro trop court pour Bénin'
    );
    const custom = zPhone({
      country: 'BJ',
      message: 'Numéro invalide',
    }).safeParse('');
    expect(custom.error?.issues[0]?.message).toBe('Numéro invalide');
    const en = zPhone({
      country: 'FR',
      locale: 'en',
      allowedNumberTypes: ['MOBILE'],
    }).safeParse('0142685300');
    expect(en.error?.issues[0]?.message).toBe('Please enter a mobile number');
  });
});
