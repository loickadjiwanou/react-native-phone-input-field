import { useMemo, useState } from 'react';
import { Image, StyleSheet, Switch, Text, View } from 'react-native';
import {
  BJ_OPERATOR_RULE,
  PhoneField,
  type CountryCode,
} from 'react-native-phone-input-field';

import { Card, Note } from '../ui/components';
import { useDemo, usePalette, useT } from '../ui/DemoContext';

/** Flag images (demo only: the library itself never hits the network). */
function FlagImage({ iso2, size }: { iso2: CountryCode; size: number }) {
  return (
    <Image
      source={{ uri: `https://flagcdn.com/w80/${iso2.toLowerCase()}.png` }}
      style={{ width: size * 1.4, height: size, borderRadius: 3 }}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Demo 4: underlined variant, image flags, full-screen picker, brand theme. */
export function CustomDemo() {
  const t = useT();
  const { dark } = useDemo();
  const c = usePalette();
  const [operatorRule, setOperatorRule] = useState(false);
  const brand = useMemo(
    () => ({
      colors: dark
        ? {
            primary: '#C4B5FD',
            success: '#6EE7B7',
            error: '#FDA4AF',
            highlight: '#2E1065',
          }
        : {
            primary: '#6D28D9',
            success: '#047857',
            error: '#BE123C',
            highlight: '#F5F3FF',
          },
      radius: { field: 0, modal: 0, item: 0, search: 999 },
      fontSizes: { callingCode: 18 },
    }),
    [dark]
  );

  return (
    <Card
      title="Ultra-custom"
      subtitle={t(
        'Variante « underlined », drapeaux en images via renderFlag, modal plein écran avec index alphabétique, thème de marque, chevron et icône d’état personnalisés.',
        'Underlined variant, image flags via renderFlag, full-screen picker with alphabet index, brand theme, custom chevron and status icon.'
      )}
    >
      <PhoneField
        variant="underlined"
        size="lg"
        label={t('Téléphone professionnel', 'Work phone')}
        defaultCountry="BJ"
        theme={brand}
        renderFlag={(iso2, size) => <FlagImage iso2={iso2} size={size * 0.8} />}
        renderChevron={(open) => (
          <Text style={{ color: brand.colors.primary, fontSize: 12 }}>
            {open ? '▲' : '▼'}
          </Text>
        )}
        showStatusIcon
        renderStatusIcon={(state) => (
          <Text style={{ fontSize: 18 }}>
            {state === 'valid' ? '🎉' : '⚠️'}
          </Text>
        )}
        modalPresentation="fullScreen"
        modalTitle={t('Choisissez votre pays', 'Choose your country')}
        showAlphabetIndex
        autoFocusSearch
        customRules={operatorRule ? { BJ: BJ_OPERATOR_RULE } : undefined}
        labelStyle={styles.label}
        inputStyle={styles.input}
        modalStyles={{ title: styles.modalTitle }}
      />
      <View style={styles.row}>
        <Switch
          value={operatorRule}
          onValueChange={setOperatorRule}
          accessibilityLabel="BJ_OPERATOR_RULE"
        />
        <Text style={[styles.switchLabel, { color: c.text }]}>
          {t(
            'Activer BJ_OPERATOR_RULE (opérateurs béninois)',
            'Enable BJ_OPERATOR_RULE (Beninese operators)'
          )}
        </Text>
      </View>
      <Note>
        {t(
          'Avec la règle : 01 97 12 34 56 est accepté, 01 25 12 34 56 est refusé dès « 0125 ».',
          'With the rule: 01 97 12 34 56 is accepted, 01 25 12 34 56 is rejected from "0125".'
        )}
      </Note>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  input: { fontSize: 20, fontWeight: '600' },
  modalTitle: { fontSize: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, flex: 1 },
});
