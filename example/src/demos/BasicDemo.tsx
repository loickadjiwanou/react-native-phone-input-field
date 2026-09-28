import { useRef, useState } from 'react';
import {
  PhoneField,
  type PhoneFieldRef,
  type PhoneValue,
} from 'react-native-phone-input-field';

import { Button, Card, JsonView, Note } from '../ui/components';
import { useT } from '../ui/DemoContext';

/** Demo 1: a field, a "Check" button and the resulting PhoneValue. */
export function BasicDemo() {
  const t = useT();
  const ref = useRef<PhoneFieldRef>(null);
  const [live, setLive] = useState<PhoneValue | null>(null);
  const [checked, setChecked] = useState<PhoneValue | null>(null);

  return (
    <>
      <Card
        title={t('Basique', 'Basic')}
        subtitle={t(
          'Tapez un numéro : la bordure devient rouge dès que c’est certainement faux, verte quand c’est valide. Collez « +33 6 12 34 56 78 » pour voir la détection du pays.',
          'Type a number: the border turns red as soon as it is certainly wrong, green when valid. Paste "+33 6 12 34 56 78" to see country detection.'
        )}
      >
        <PhoneField
          ref={ref}
          label={t('Numéro de téléphone', 'Phone number')}
          defaultCountry="BJ"
          preferredCountries={['BJ', 'TG', 'CI', 'SN', 'FR']}
          required
          clearable
          showAlphabetIndex
          onChangePhone={setLive}
        />
        <Button
          title={t('Vérifier', 'Check')}
          onPress={() => setChecked(ref.current!.validate())}
        />
        {checked ? (
          <Note tone={checked.isValid ? 'success' : 'error'}>
            {checked.isValid
              ? t(
                  `✓ À envoyer au backend : ${checked.e164}`,
                  `✓ Send to your backend: ${checked.e164}`
                )
              : `✗ ${checked.errorMessage}`}
          </Note>
        ) : null}
      </Card>
      <Card
        title="PhoneValue"
        subtitle={t(
          'Mis à jour à chaque frappe (onChangePhone).',
          'Updated on every keystroke (onChangePhone).'
        )}
      >
        <JsonView
          value={live ?? t('Rien tapé pour l’instant', 'Nothing typed yet')}
        />
      </Card>
    </>
  );
}
