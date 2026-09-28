import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  PhoneField,
  type CountryCode,
  type PhoneFieldRef,
} from 'react-native-phone-input-field';

import { Button, Card, Note } from '../ui/components';
import { useT } from '../ui/DemoContext';

const WEST_AFRICA: CountryCode[] = [
  'BJ',
  'TG',
  'CI',
  'SN',
  'BF',
  'NE',
  'NG',
  'GH',
];

/** Demo 3: mobile numbers only, for SMS one-time passwords. */
export function OtpDemo() {
  const t = useT();
  const ref = useRef<PhoneFieldRef>(null);
  const [valid, setValid] = useState(false);
  const [recents, setRecents] = useState<CountryCode[]>([]);
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <Card
      title={t('Mobile uniquement (OTP)', 'Mobile only (OTP)')}
      subtitle={t(
        'allowedNumberTypes={["MOBILE"]} : un numéro fixe est refusé dès son préfixe. Pays suggérés : Afrique de l’Ouest. Retour haptique quand le numéro devient valide.',
        'allowedNumberTypes={["MOBILE"]}: landlines are rejected from their prefix. Suggested countries: West Africa. Haptic feedback when the number becomes valid.'
      )}
    >
      <PhoneField
        ref={ref}
        label={t('Votre numéro mobile', 'Your mobile number')}
        defaultCountry="BJ"
        preferredCountries={WEST_AFRICA}
        allowedNumberTypes={['MOBILE']}
        required
        size="lg"
        recentCountries={recents}
        onRecentsChange={setRecents}
        onValidityChange={setValid}
        onValidHaptic={() => {
          if (Platform.OS !== 'web')
            void Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
        }}
        helperText={t(
          'Nous vous enverrons un code par SMS.',
          'We will text you a code.'
        )}
      />
      <Button
        title={t('Recevoir le code', 'Get the code')}
        disabled={!valid}
        onPress={() => {
          const res = ref.current!.validate();
          if (!res.isValid) return;
          setSentTo(res.international);
        }}
      />
      {sentTo ? (
        <Note tone="success">
          {t(`✓ Code envoyé au ${sentTo}`, `✓ Code sent to ${sentTo}`)}
        </Note>
      ) : null}
    </Card>
  );
}
