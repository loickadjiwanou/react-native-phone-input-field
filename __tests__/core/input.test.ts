import {
  parseExternalValue,
  processPhoneInput,
  reformatForCountry,
  type PhoneInputState,
} from 'react-native-phone-input-field/core';

/** Types `chars` one by one at the end, like a keyboard. */
function typeChars(state: PhoneInputState, chars: string) {
  let current = { ...state, caret: state.text.length, rejected: false };
  for (const ch of chars) {
    current = processPhoneInput(current, current.text + ch);
  }
  return current;
}

describe('processPhoneInput', () => {
  it('formats as you type (BJ)', () => {
    const result = typeChars({ text: '', country: 'BJ' }, '0197123456');
    expect(result.text).toBe('01 97 12 34 56');
    expect(result.caret).toBe(result.text.length);
  });

  it('formats as you type (FR, with and without trunk prefix)', () => {
    expect(typeChars({ text: '', country: 'FR' }, '0612345678').text).toBe(
      '06 12 34 56 78'
    );
    // libphonenumber only formats French numbers with their trunk prefix.
    expect(typeChars({ text: '', country: 'FR' }, '612345678').text).toBe(
      '612345678'
    );
  });

  it('backspace on a separator deletes the previous digit', () => {
    // "01 97 12" → user deletes the space after "97" → "01 9712"
    const result = processPhoneInput(
      { text: '01 97 12', country: 'BJ' },
      '01 9712'
    );
    expect(result.text).toBe('01 91 2');
    expect(result.caret).toBe(4); // right after "01 9"
  });

  it('keeps the caret after an insertion in the middle', () => {
    // "01 97 12 34" → insert "5" after "01 9"
    const result = processPhoneInput(
      { text: '01 97 12 34', country: 'BJ' },
      '01 957 12 34'
    );
    expect(result.text).toBe('01 95 71 23 4');
    expect(result.caret).toBe(5); // after "01 95"
  });

  it('keeps the caret after a deletion in the middle', () => {
    // delete the "7" of "01 97 12 34"
    const result = processPhoneInput(
      { text: '01 97 12 34', country: 'BJ' },
      '01 9 12 34'
    );
    expect(result.text).toBe('01 91 23 4');
    expect(result.caret).toBe(4); // after "01 9"
  });

  it('detects the country when pasting an international number', () => {
    for (const pasted of [
      '+33 6 12 34 56 78',
      '0033612345678',
      '(+33) 6 12 34 56 78',
      '+33612345678',
    ]) {
      const result = processPhoneInput({ text: '', country: 'BJ' }, pasted);
      expect(result.country).toBe('FR');
      expect(result.text).toBe('06 12 34 56 78');
      expect(result.caret).toBe(result.text.length);
    }
  });

  it('keeps BJ when pasting +229', () => {
    const result = processPhoneInput(
      { text: '', country: 'FR' },
      '+229 01 97 12 34 56'
    );
    expect(result).toMatchObject({ country: 'BJ', text: '01 97 12 34 56' });
  });

  it('keeps a partial "+" input until the calling code is known', () => {
    let s = processPhoneInput({ text: '', country: 'FR' }, '+');
    expect(s).toMatchObject({ text: '+', country: 'FR' });
    s = processPhoneInput({ ...s }, '+2');
    expect(s).toMatchObject({ text: '+2', country: 'FR' });
    s = processPhoneInput({ ...s }, '+22');
    expect(s.text).toBe('+22');
    s = processPhoneInput({ ...s }, '+229');
    expect(s).toMatchObject({ text: '', country: 'BJ' });
  });

  it('turns "00" into "+" when it cannot start a national number', () => {
    const s = processPhoneInput({ text: '0', country: 'FR' }, '00');
    expect(s.text).toBe('+');
  });

  it('keeps an unknown calling code visible', () => {
    const s = processPhoneInput({ text: '+99', country: 'FR' }, '+999');
    expect(s).toMatchObject({ text: '+999', country: 'FR' });
  });

  it('keeps the international text when the country is not allowed', () => {
    const s = processPhoneInput({ text: '', country: 'BJ' }, '+33612345678', {
      onlyCountries: ['BJ', 'TG'],
    });
    expect(s.country).toBe('BJ');
    expect(s.text.startsWith('+33')).toBe(true);
  });

  it('does not switch country when auto-detection is disabled', () => {
    const s = processPhoneInput({ text: '', country: 'BJ' }, '+33612345678', {
      autoDetectCountry: false,
    });
    expect(s.country).toBe('BJ');
    expect(s.text.startsWith('+33')).toBe(true);
    const same = processPhoneInput(
      { text: '', country: 'BJ' },
      '+2290197123456',
      {
        autoDetectCountry: false,
      }
    );
    expect(same).toMatchObject({ country: 'BJ', text: '01 97 12 34 56' });
  });

  it('switches US → CA when a Canadian number is typed', () => {
    const result = typeChars({ text: '', country: 'US' }, '4165551234');
    expect(result.country).toBe('CA');
    expect(result.text).toBe('(416) 555-1234');
  });

  it('refuses digits beyond the maximum length', () => {
    const full = typeChars({ text: '', country: 'BJ' }, '0197123456');
    const extra = processPhoneInput(full, `${full.text}7`);
    expect(extra.rejected).toBe(true);
    expect(extra.text).toBe('01 97 12 34 56');
  });

  it('lets users type too many digits when limitMaxLength is false', () => {
    const full = typeChars({ text: '', country: 'BJ' }, '0197123456');
    const extra = processPhoneInput(full, `${full.text}78`, {
      limitMaxLength: false,
    });
    expect(extra.rejected).toBe(false);
    expect(extra.text.replace(/\D/g, '')).toBe('019712345678');
  });

  it('truncates a pasted national number that is too long', () => {
    const result = processPhoneInput(
      { text: '', country: 'BJ' },
      '01971234567890'
    );
    expect(result.text).toBe('01 97 12 34 56');
    expect(result.rejected).toBe(false);
  });

  it('normalizes Arabic and Persian digits', () => {
    expect(
      processPhoneInput({ text: '', country: 'BJ' }, '٠١٩٧١٢٣٤٥٦').text
    ).toBe('01 97 12 34 56');
    expect(
      processPhoneInput({ text: '', country: 'BJ' }, '۰۱۹۷۱۲۳۴۵۶').text
    ).toBe('01 97 12 34 56');
  });

  it('returns the previous text when nothing changed', () => {
    expect(
      processPhoneInput({ text: '01', country: 'BJ' }, '01')
    ).toMatchObject({ text: '01', rejected: false });
  });

  it('clears everything', () => {
    expect(processPhoneInput({ text: '01', country: 'BJ' }, '').text).toBe('');
  });

  it('backspace on a leading separator with no digit before keeps the text sane', () => {
    const s = processPhoneInput({ text: '(4', country: 'US' }, '4');
    expect(s.text.replace(/\D/g, '')).toBe('4');
  });
});

describe('parseExternalValue', () => {
  it('parses E.164 and national values', () => {
    expect(parseExternalValue('+2290197123456', 'FR')).toEqual({
      text: '01 97 12 34 56',
      country: 'BJ',
    });
    expect(parseExternalValue('0197123456', 'BJ')).toEqual({
      text: '01 97 12 34 56',
      country: 'BJ',
    });
    expect(parseExternalValue('', 'BJ')).toEqual({ text: '', country: 'BJ' });
    expect(parseExternalValue(undefined, 'BJ')).toEqual({
      text: '',
      country: 'BJ',
    });
  });
});

describe('reformatForCountry', () => {
  it('re-formats digits for the new country', () => {
    expect(reformatForCountry('0612345678', 'FR')).toBe('06 12 34 56 78');
    expect(reformatForCountry('+2290197', 'FR')).toBe('+229 01 97');
    expect(reformatForCountry('', 'FR')).toBe('');
  });
});
