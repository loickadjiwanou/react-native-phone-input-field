import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { AccessibilityInfo, Animated, Text } from 'react-native';

import {
  PhoneField,
  PhoneFieldThemeProvider,
} from 'react-native-phone-input-field';

import { renderField } from '../helpers/renderField';

describe('<PhoneField /> states (spec §4.2)', () => {
  it('focused → invalid (impossible prefix while typing) → valid', async () => {
    const t = await renderField();
    expect(t.field().state).toBe('idle');
    await t.focus();
    expect(t.field().state).toBe('focused');

    await t.type('9'); // no Beninese number starts with 9 (old plan)
    expect(t.field().state).toBe('invalid');
    expect(t.field().errorVisible).toBe(true);
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Numéro invalide pour Bénin'
    );
    expect(
      screen.getByTestId('status-icon-invalid', { includeHiddenElements: true })
    ).toBeOnTheScreen();

    await t.type('');
    await t.type('0197123456');
    expect(t.input()).toHaveDisplayValue('01 97 12 34 56');
    expect(t.field().state).toBe('valid');
    expect(
      screen.getByTestId('status-icon-valid', { includeHiddenElements: true })
    ).toBeOnTheScreen();
    expect(screen.getByTestId('phone-field-helper')).toHaveTextContent(
      'Numéro valide · Mobile'
    );
  });

  it('incomplete is only red after blur', async () => {
    const t = await renderField();
    await t.focus();
    await t.type('0197');
    expect(t.field().state).toBe('incomplete');
    expect(t.field().errorVisible).toBe(false);
    expect(screen.queryByTestId('phone-field-error')).toBeNull();

    await t.blur();
    expect(t.field().state).toBe('incomplete');
    expect(t.field().errorVisible).toBe(true);
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Numéro trop court pour Bénin'
    );

    // Back to typing: primary color again, no error.
    await t.focus();
    expect(t.field().errorVisible).toBe(false);
  });

  it('showIncompleteAsError="always" and "never"', async () => {
    const always = await renderField({ showIncompleteAsError: 'always' });
    await always.focus();
    await always.type('0197');
    expect(always.field().errorVisible).toBe(true);
    await always.unmount();

    const never = await renderField({ showIncompleteAsError: 'never' });
    await never.focus();
    await never.type('0197');
    await never.blur();
    expect(never.field().errorVisible).toBe(false);
  });

  it('validateOn="blur" and "submit" delay the feedback', async () => {
    const onBlurMode = await renderField({ validateOn: 'blur' });
    await onBlurMode.focus();
    await onBlurMode.type('9');
    expect(onBlurMode.field().errorVisible).toBe(false);
    await onBlurMode.blur();
    expect(onBlurMode.field().state).toBe('invalid');
    await onBlurMode.unmount();

    const submit = await renderField({ validateOn: 'submit' });
    await submit.focus();
    await submit.type('9');
    await submit.blur();
    expect(submit.field().errorVisible).toBe(false);
    await act(async () => {
      submit.ref.current!.validate();
    });
    expect(submit.field().state).toBe('invalid');
  });

  it('ref.validate() forces the error, shakes and returns isValid: false', async () => {
    const t = await renderField({ required: true });
    let result!: ReturnType<NonNullable<typeof t.ref.current>['validate']>;
    await act(async () => {
      result = t.ref.current!.validate();
    });
    expect(result).toMatchObject({
      isValid: false,
      error: 'REQUIRED',
      e164: null,
    });
    expect(result.errorMessage).toBe('Le numéro de téléphone est requis');
    expect(t.field().state).toBe('invalid');
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Le numéro de téléphone est requis'
    );

    await t.type('0197');
    await act(async () => {
      result = t.ref.current!.validate();
    });
    expect(result).toMatchObject({
      isValid: false,
      error: 'TOO_SHORT',
      state: 'incomplete',
    });
    expect(t.field().errorVisible).toBe(true);

    await t.type('0197123456');
    await act(async () => {
      result = t.ref.current!.validate();
    });
    expect(result).toMatchObject({
      isValid: true,
      e164: '+2290197123456',
      state: 'valid',
    });
    expect(t.ref.current!.isValid()).toBe(true);
  });

  it('pasting a +33 number switches to France', async () => {
    const onCountryChange = jest.fn();
    const t = await renderField({ onCountryChange });
    await t.type('+33 6 12 34 56 78');
    expect(t.field().country.iso2).toBe('FR');
    expect(t.input()).toHaveDisplayValue('06 12 34 56 78');
    expect(onCountryChange).toHaveBeenCalledWith(
      expect.objectContaining({ iso2: 'FR', callingCode: '33' })
    );
    expect(
      screen.getByTestId('phone-field-country-trigger')
    ).toHaveAccessibleName('Pays sélectionné : France, +33');
    expect(t.field().value.e164).toBe('+33612345678');
  });

  it('open the modal, search "cote", select CI → reformat', async () => {
    const onCountryChange = jest.fn();
    const onChangePhone = jest.fn();
    const t = await renderField({
      onCountryChange,
      onChangePhone,
      modalProps: { hideModalContentWhileAnimating: false },
    });
    await t.type('0701020304');
    await fireEvent.press(screen.getByTestId('phone-field-country-trigger'));
    expect(t.field().isPickerOpen).toBe(true);
    expect(screen.getByTestId('phone-field-country-trigger')).toBeExpanded();

    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      'cote'
    );
    const list = await screen.findByTestId(
      'phone-field-country-list',
      {},
      { timeout: 3000 }
    );
    await fireEvent.press(within(list).getByTestId('country-item-CI'));

    expect(t.field().isPickerOpen).toBe(false);
    expect(t.field().country.iso2).toBe('CI');
    expect(onCountryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ iso2: 'CI' })
    );
    // Re-formatted and re-validated for Côte d'Ivoire, without clearing.
    expect(t.input()).toHaveDisplayValue('07 01 02 0304'); // official CI grouping
    expect(t.field().value.isValid).toBe(true);
    expect(onChangePhone).toHaveBeenLastCalledWith(
      expect.objectContaining({ country: 'CI', e164: '+2250701020304' })
    );
    expect(t.field().recentCountries.map((c) => c.iso2)).toEqual(['CI']);
  });

  it('onValidityChange is only called when validity flips', async () => {
    const onValidityChange = jest.fn();
    const t = await renderField({ onValidityChange });
    await t.type('019712345');
    expect(onValidityChange).not.toHaveBeenCalled();
    await t.type('0197123456');
    expect(onValidityChange).toHaveBeenCalledTimes(1);
    expect(onValidityChange).toHaveBeenLastCalledWith(
      true,
      expect.objectContaining({ e164: '+2290197123456' })
    );
    // Still valid after re-typing the same thing: no call.
    await t.type('01 97 12 34 56');
    expect(onValidityChange).toHaveBeenCalledTimes(1);
    await t.type('01 97 12 34 5');
    expect(onValidityChange).toHaveBeenCalledTimes(2);
    expect(onValidityChange).toHaveBeenLastCalledWith(false, expect.anything());
  });

  it('calls onValidHaptic and announces validity to screen readers', async () => {
    const onValidHaptic = jest.fn();
    const t = await renderField({ onValidHaptic });
    await t.type('0197123456');
    expect(onValidHaptic).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Numéro valide'
    );
    await t.type('9');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Numéro invalide : Numéro invalide pour Bénin'
    );
  });

  it('allowedNumberTypes={["MOBILE"]} shows WRONG_TYPE while typing', async () => {
    const t = await renderField({
      defaultCountry: 'FR',
      allowedNumberTypes: ['MOBILE'],
    });
    await t.type('01');
    expect(t.field().state).toBe('invalid');
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Veuillez saisir un numéro mobile'
    );
  });

  it('forced error from props and ref.setError (cleared when typing)', async () => {
    const t = await renderField({ defaultValue: '+2290197123456' });
    expect(t.field().state).toBe('valid');
    await act(async () => t.ref.current!.setError('Numéro déjà utilisé'));
    expect(t.field().state).toBe('invalid');
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Numéro déjà utilisé'
    );
    await t.type('01 97 12 34 57');
    expect(t.field().state).toBe('valid');
    await t.unmount();

    const forced = await renderField({ error: 'Erreur serveur' });
    expect(forced.field().state).toBe('invalid');
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Erreur serveur'
    );
  });

  it('disabled state', async () => {
    const t = await renderField({
      editable: false,
      defaultValue: '0197123456',
    });
    expect(t.field().state).toBe('disabled');
    expect(t.input().props.editable).toBe(false);
    await fireEvent.press(screen.getByTestId('phone-field-country-trigger'));
    expect(t.field().isPickerOpen).toBe(false);
  });

  it('countrySelectable={false} freezes the country', async () => {
    const t = await renderField({ countrySelectable: false });
    expect(screen.queryByText('▾')).toBeNull();
    await fireEvent.press(screen.getByTestId('phone-field-country-trigger'));
    expect(t.field().isPickerOpen).toBe(false);
    await t.type('+33612345678');
    expect(t.field().country.iso2).toBe('BJ');
    expect(t.field().state).toBe('invalid');
  });

  it('clearable + ref API (setValue, setCountry, clear, open/close picker, focus/blur)', async () => {
    const onChangeText = jest.fn();
    const t = await renderField({ clearable: true, onChangeText });
    await act(async () => t.ref.current!.setValue('+33612345678'));
    expect(t.field().country.iso2).toBe('FR');
    expect(onChangeText).toHaveBeenLastCalledWith('06 12 34 56 78');
    expect(t.ref.current!.getValue().e164).toBe('+33612345678');

    await fireEvent.press(screen.getByTestId('phone-field-clear'));
    expect(t.input()).toHaveDisplayValue('');

    await act(async () => t.ref.current!.setValue('0197123456', 'BJ'));
    expect(t.input()).toHaveDisplayValue('01 97 12 34 56');
    await act(async () => t.ref.current!.setCountry('TG'));
    expect(t.field().country.iso2).toBe('TG');
    await act(async () => t.ref.current!.clear());
    expect(t.input()).toHaveDisplayValue('');

    await act(async () => t.ref.current!.openCountryPicker());
    expect(t.field().isPickerOpen).toBe(true);
    await act(async () => t.ref.current!.closeCountryPicker());
    expect(t.field().isPickerOpen).toBe(false);
    await act(async () => {
      t.ref.current!.focus();
      t.ref.current!.blur();
      t.ref.current!.shake();
    });
  });

  it('controlled value and country', async () => {
    const onChangePhone = jest.fn();
    const utils = await render(
      <PhoneField
        value="+2290197123456"
        onChangePhone={onChangePhone}
        testID="phone-field"
      />
    );
    expect(screen.getByTestId('phone-field-input')).toHaveDisplayValue(
      '01 97 12 34 56'
    );
    await utils.rerender(
      <PhoneField
        value="+33612345678"
        onChangePhone={onChangePhone}
        testID="phone-field"
      />
    );
    expect(screen.getByTestId('phone-field-input')).toHaveDisplayValue(
      '06 12 34 56 78'
    );
    await utils.rerender(
      <PhoneField
        value="0612345678"
        country="FR"
        onChangePhone={onChangePhone}
        testID="phone-field"
      />
    );
    expect(screen.getByTestId('phone-field-input')).toHaveDisplayValue(
      '06 12 34 56 78'
    );
  });

  it('label, required marker, helper text and placeholder', async () => {
    await renderField({
      label: 'Téléphone',
      required: true,
      helperText: 'Pour recevoir le code',
    });
    expect(screen.getByText(/Téléphone/)).toBeOnTheScreen();
    expect(screen.getByText(' *')).toBeOnTheScreen();
    expect(screen.getByTestId('phone-field-helper')).toHaveTextContent(
      'Pour recevoir le code'
    );
    expect(screen.getByTestId('phone-field-input').props.placeholder).toBe(
      '01 •• •• •• ••'
    );
    expect(screen.getByTestId('phone-field-input').props.keyboardType).toBe(
      'phone-pad'
    );
    expect(screen.getByTestId('phone-field-input').props.autoComplete).toBe(
      'tel'
    );
    expect(screen.getByTestId('phone-field-input').props.textContentType).toBe(
      'telephoneNumber'
    );
  });

  it('render props replace every visual part', async () => {
    await renderField({
      renderFlag: (iso2) => <Text>flag:{iso2}</Text>,
      renderChevron: (open) => <Text>{open ? 'up' : 'down'}</Text>,
      renderStatusIcon: (state) => <Text>status:{state}</Text>,
      renderRight: () => <Text>right</Text>,
      defaultValue: '0197123456',
    });
    expect(screen.getByText('flag:BJ')).toBeOnTheScreen();
    expect(screen.getByText('down')).toBeOnTheScreen();
    expect(screen.getByText('status:valid')).toBeOnTheScreen();
    expect(screen.getByText('right')).toBeOnTheScreen();
  });

  it('renderModal plugs a custom picker with a typed contract', async () => {
    const t = await renderField({
      preferredCountries: ['TG'],
      renderModal: ({ visible, countries, onSelect, selected, onClose }) =>
        visible ? (
          <>
            <Text>
              custom:{selected.iso2}:{countries.length > 200 ? 'all' : 'few'}
            </Text>
            <Text onPress={() => onSelect('SN')}>pick-sn</Text>
            <Text onPress={onClose}>close</Text>
          </>
        ) : null,
    });
    await fireEvent.press(screen.getByTestId('phone-field-country-trigger'));
    expect(screen.getByText('custom:BJ:all')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('pick-sn'));
    expect(t.field().country.iso2).toBe('SN');
    expect(screen.queryByText('custom:SN:all')).toBeNull();
  });

  it('uses the provider locale and theme', async () => {
    await render(
      <PhoneFieldThemeProvider
        locale="en"
        theme={{ colors: { primary: '#7C3AED' } }}
      >
        <PhoneField defaultCountry="BJ" required />
      </PhoneFieldThemeProvider>
    );
    expect(
      screen.getByTestId('phone-field-country-trigger')
    ).toHaveAccessibleName('Selected country: Benin, +229');
  });

  it('lang switches the UI and country names, and wins over locale', async () => {
    const t = await renderField({ lang: 'en' });
    expect(t.field().country.name).toBe('Benin');
    expect(t.field().messages.modalTitle).toBe('Select a country');

    await t.rerender(<PhoneField defaultCountry="BJ" lang="fr" locale="en" />);
    expect(
      screen.getByTestId('phone-field-country-trigger')
    ).toHaveAccessibleName('Pays sélectionné : Bénin, +229');
  });

  it('variants and sizes render', async () => {
    for (const variant of ['outlined', 'filled', 'underlined'] as const) {
      for (const size of ['sm', 'md', 'lg'] as const) {
        const utils = await render(
          <PhoneField defaultCountry="BJ" variant={variant} size={size} />
        );
        expect(screen.getByTestId('phone-field-container')).toBeOnTheScreen();
        await utils.unmount();
      }
    }
  });

  it('containerStyleByState applies the invalid style when an error is visible', async () => {
    const t = await renderField({
      containerStyleByState: {
        invalid: { backgroundColor: 'pink' },
        incomplete: { backgroundColor: 'yellow' },
      },
    });
    await t.focus();
    await t.type('0197');
    expect(screen.getByTestId('phone-field-container')).toHaveStyle({
      backgroundColor: 'yellow',
    });
    await t.blur();
    expect(screen.getByTestId('phone-field-container')).toHaveStyle({
      backgroundColor: 'pink',
    });
  });

  it('errorDebounceMs delays the red while typing', async () => {
    jest.useFakeTimers();
    try {
      const t = await renderField({ errorDebounceMs: 400 });
      await t.focus();
      await t.type('9');
      expect(t.field().errorVisible).toBe(false);
      expect(t.field().state).toBe('focused');
      await act(async () => {
        jest.advanceTimersByTime(450);
      });
      expect(t.field().errorVisible).toBe(true);
      expect(t.field().state).toBe('invalid');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('<PhoneField /> default visuals', () => {
  it('shakes on validate() only with animateOnError', async () => {
    const spy = jest.spyOn(Animated, 'sequence');
    const quiet = await renderField({ required: true });
    await act(async () => {
      quiet.ref.current!.validate();
    });
    expect(spy).not.toHaveBeenCalled();
    await quiet.unmount();
    const shaky = await renderField({ required: true, animateOnError: true });
    await act(async () => {
      shaky.ref.current!.validate();
    });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('only changes the border: no message, no status icon', async () => {
    await render(<PhoneField defaultCountry="BJ" />);
    const input = screen.getByTestId('phone-field-input');
    await fireEvent.changeText(input, '9');
    expect(screen.queryByTestId('phone-field-error')).toBeNull();
    expect(
      screen.queryByTestId('status-icon-invalid', {
        includeHiddenElements: true,
      })
    ).toBeNull();
    // The error is still exposed to screen readers.
    expect(input.props.accessibilityHint).toBe('Numéro invalide pour Bénin');
    await fireEvent.changeText(input, '0197123456');
    expect(screen.queryByText(/Numéro valide/)).toBeNull();
    expect(
      screen.queryByTestId('status-icon-valid', { includeHiddenElements: true })
    ).toBeNull();
  });

  it('still shows server errors', async () => {
    await render(
      <PhoneField defaultCountry="BJ" error="Numéro déjà utilisé" />
    );
    expect(screen.getByTestId('phone-field-error')).toHaveTextContent(
      'Numéro déjà utilisé'
    );
  });

  it('keeps an explicit helperText', async () => {
    await render(
      <PhoneField defaultCountry="BJ" helperText="Pour recevoir le code" />
    );
    expect(screen.getByTestId('phone-field-helper')).toHaveTextContent(
      'Pour recevoir le code'
    );
  });
});

describe('<PhoneField /> snapshots', () => {
  it('light', async () => {
    const utils = await render(
      <PhoneField defaultCountry="BJ" label="Téléphone" colorScheme="light" />
    );
    expect(utils.toJSON()).toMatchSnapshot();
  });

  it('dark', async () => {
    const utils = await render(
      <PhoneField defaultCountry="BJ" label="Téléphone" colorScheme="dark" />
    );
    expect(utils.toJSON()).toMatchSnapshot();
  });
});
