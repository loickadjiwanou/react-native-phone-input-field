import { act, renderHook } from '@testing-library/react-native';

import {
  analyzePhoneNumber,
  computeDisplayState,
  resolveDefaultCountry,
  usePhoneField,
  type DisplayInput,
} from 'react-native-phone-input-field';

const interaction = {
  focused: false,
  touched: false,
  dirty: false,
  submitted: false,
};

function display(
  input: string,
  overrides: Partial<DisplayInput> = {},
  required = false
) {
  const analysis = analyzePhoneNumber(input, 'BJ', { required });
  return computeDisplayState({
    analysis,
    isValid: analysis.isValid,
    interaction,
    editable: true,
    externalError: null,
    validateOn: 'change',
    showIncompleteAsError: 'onBlur',
    ...overrides,
  });
}

describe('computeDisplayState', () => {
  it('idle / focused when empty', () => {
    expect(display('')).toEqual({ state: 'idle', errorVisible: false });
    expect(
      display('', { interaction: { ...interaction, focused: true } })
    ).toEqual({
      state: 'focused',
      errorVisible: false,
    });
  });

  it('REQUIRED shows on submit, or after a dirty blur', () => {
    expect(display('', {}, true).errorVisible).toBe(false);
    expect(
      display('', { interaction: { ...interaction, submitted: true } }, true)
    ).toEqual({
      state: 'invalid',
      errorVisible: true,
    });
    expect(
      display(
        '',
        { interaction: { ...interaction, dirty: true, touched: true } },
        true
      ).errorVisible
    ).toBe(true);
    expect(
      display(
        '',
        {
          validateOn: 'submit',
          interaction: { ...interaction, dirty: true, touched: true },
        },
        true
      ).errorVisible
    ).toBe(false);
  });

  it('NOT_A_NUMBER is invalid', () => {
    expect(display('abc').state).toBe('invalid');
  });

  it('disabled and external errors', () => {
    expect(display('0197123456', { editable: false }).state).toBe('disabled');
    expect(
      display('0197123456', { editable: false, externalError: 'x' })
        .errorVisible
    ).toBe(true);
    expect(display('0197123456', { externalError: true })).toEqual({
      state: 'invalid',
      errorVisible: true,
    });
  });

  it('valid only shows once feedback is active', () => {
    expect(display('0197123456').state).toBe('valid');
    expect(display('0197123456', { validateOn: 'submit' }).state).toBe('idle');
    expect(
      display('0197123456', {
        validateOn: 'blur',
        interaction: { ...interaction, touched: true },
      }).state
    ).toBe('valid');
  });

  it('invalid waits for feedback activation', () => {
    expect(
      display('9', {
        validateOn: 'submit',
        interaction: { ...interaction, focused: true },
      })
    ).toEqual({
      state: 'focused',
      errorVisible: false,
    });
  });

  it('incomplete rules', () => {
    expect(display('0197')).toEqual({
      state: 'incomplete',
      errorVisible: false,
    });
    expect(
      display('0197', { interaction: { ...interaction, touched: true } })
        .errorVisible
    ).toBe(true);
    expect(
      display('0197', { showIncompleteAsError: 'always' }).errorVisible
    ).toBe(true);
    expect(
      display('0197', {
        showIncompleteAsError: 'never',
        interaction: { ...interaction, touched: true },
      }).errorVisible
    ).toBe(false);
    expect(
      display('0197', {
        showIncompleteAsError: 'never',
        interaction: { ...interaction, submitted: true },
      }).errorVisible
    ).toBe(true);
  });
});

describe('usePhoneField', () => {
  it('works headless', async () => {
    const onChangePhone = jest.fn();
    const onRecentsChange = jest.fn();
    const { result } = await renderHook(() =>
      usePhoneField({
        defaultCountry: 'BJ',
        onChangePhone,
        onRecentsChange,
        maxRecents: 2,
        recentCountries: ['FR'],
      })
    );
    expect(result.current.country.iso2).toBe('BJ');
    expect(result.current.recentCountries.map((c) => c.iso2)).toEqual(['FR']);
    await act(async () => result.current.onChangeText('0197123456'));
    expect(result.current.text).toBe('01 97 12 34 56');
    expect(result.current.isValid).toBe(true);
    expect(onChangePhone).toHaveBeenLastCalledWith(
      expect.objectContaining({ e164: '+2290197123456' })
    );

    await act(async () => result.current.openPicker());
    expect(result.current.isPickerOpen).toBe(true);
    await act(async () => result.current.selectCountry('TG'));
    await act(async () => result.current.selectCountry('SN'));
    expect(result.current.isPickerOpen).toBe(false);
    expect(onRecentsChange).toHaveBeenLastCalledWith(['SN', 'TG']);
    expect(result.current.recentCountries.map((c) => c.iso2)).toEqual([
      'SN',
      'TG',
    ]);
  });

  it('clearOnCountryChange empties the input', async () => {
    const { result } = await renderHook(() =>
      usePhoneField({ defaultCountry: 'BJ', clearOnCountryChange: true })
    );
    await act(async () => result.current.onChangeText('0197'));
    await act(async () => result.current.selectCountry('FR'));
    expect(result.current.text).toBe('');
  });

  it('keeps the caret in place after a middle edit', async () => {
    const { result } = await renderHook(() =>
      usePhoneField({ defaultCountry: 'BJ' })
    );
    await act(async () => result.current.onChangeText('01971234'));
    expect(result.current.selection).toBeUndefined();
    await act(async () => result.current.onChangeText('01 957 12 34'));
    expect(result.current.selection).toEqual({ start: 5, end: 5 });
    await act(async () => result.current.onSelectionChange({} as never));
    expect(result.current.selection).toBeUndefined();
  });

  it('ignores disallowed or unknown countries', async () => {
    const { result } = await renderHook(() =>
      usePhoneField({
        defaultCountry: 'FR',
        onlyCountries: ['BJ', 'TG'],
        preferredCountries: ['TG', 'FR'],
      })
    );
    expect(result.current.country.iso2).toBe('BJ');
    expect(result.current.preferredCountries.map((c) => c.iso2)).toEqual([
      'TG',
    ]);
    expect(result.current.countries.map((c) => c.iso2)).toEqual(['BJ', 'TG']);
    await act(async () => result.current.setCountry('ZZ' as never));
    expect(result.current.country.iso2).toBe('BJ');
  });

  it('does not open the picker when not selectable', async () => {
    const { result } = await renderHook(() =>
      usePhoneField({ countrySelectable: false })
    );
    await act(async () => result.current.openPicker());
    expect(result.current.isPickerOpen).toBe(false);
  });
});

describe('resolveDefaultCountry', () => {
  it('explicit → device → fallback, restricted to allowed countries', () => {
    expect(resolveDefaultCountry('FR')).toBe('FR');
    expect(resolveDefaultCountry(undefined, { detectFromDevice: false })).toBe(
      'BJ'
    );
    expect(
      resolveDefaultCountry(undefined, {
        detectFromDevice: false,
        fallbackCountry: 'SN',
      })
    ).toBe('SN');
    expect(resolveDefaultCountry('FR', { onlyCountries: ['TG'] })).toBe('TG');
    expect(
      resolveDefaultCountry('FR', {
        excludedCountries: ['FR', 'BJ'],
        detectFromDevice: false,
        preferredCountries: ['CI'],
      })
    ).toBe('CI');
    expect(
      resolveDefaultCountry(undefined, {
        onlyCountries: ['ZZ' as never],
        detectFromDevice: false,
        fallbackCountry: 'ZZ' as never,
      })
    ).toBe('ZZ');
  });
});
