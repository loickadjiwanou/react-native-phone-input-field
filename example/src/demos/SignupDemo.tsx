import { zodResolver } from '@hookform/resolvers/zod';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { PhoneField, type PhoneFieldRef } from 'react-native-phone-input-field';
import { zPhone } from 'react-native-phone-input-field/zod';
import { z } from 'zod';

import { Button, Card, JsonView, Note } from '../ui/components';
import { useDemo, usePalette, useT } from '../ui/DemoContext';

/** Demo 2: react-hook-form + Zod, disabled submit, simulated server error. */
export function SignupDemo() {
  const t = useT();
  const { locale } = useDemo();
  const c = usePalette();
  const phoneRef = useRef<PhoneFieldRef>(null);
  const [simulateTaken, setSimulateTaken] = useState(true);
  const [submitted, setSubmitted] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(2, t('Au moins 2 caractères', 'At least 2 characters')),
    // Validates with the same engine and outputs E.164.
    phone: zPhone({ allowedNumberTypes: ['MOBILE'], locale }),
  });
  type FormInput = z.input<typeof schema>;
  type FormOutput = z.output<typeof schema>;

  const { control, handleSubmit, formState } = useForm<
    FormInput,
    unknown,
    FormOutput
  >({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setLoading(true);
    setSubmitted(null);
    await new Promise((resolve) => setTimeout(resolve, 600)); // fake API call
    setLoading(false);
    if (simulateTaken) {
      phoneRef.current?.setError(
        t('Ce numéro est déjà utilisé', 'This number is already used')
      );
      phoneRef.current?.shake();
      return;
    }
    setSubmitted(data);
  });

  return (
    <Card
      title={t('Formulaire d’inscription', 'Sign-up form')}
      subtitle={t(
        'react-hook-form + Zod (zPhone). Le bouton reste désactivé tant que le formulaire est invalide ; la réponse du serveur est affichée via ref.setError.',
        'react-hook-form + Zod (zPhone). The button stays disabled while the form is invalid; the server answer is shown with ref.setError.'
      )}
    >
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <View>
            <Text style={[styles.label, { color: c.text }]}>
              {t('Nom', 'Name')}
            </Text>
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Ada Lovelace"
              placeholderTextColor={c.muted}
              autoComplete="name"
              style={[
                styles.input,
                {
                  color: c.text,
                  borderColor: fieldState.error ? c.error : c.border,
                },
              ]}
            />
            {fieldState.error ? (
              <Note tone="error">{fieldState.error.message}</Note>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneField
            ref={phoneRef}
            label={t('Téléphone mobile', 'Mobile phone')}
            defaultCountry="BJ"
            allowedNumberTypes={['MOBILE']}
            required
            // Store E.164 when possible, the international form otherwise.
            onChangePhone={(v) => field.onChange(v.e164 ?? v.international)}
            onBlur={field.onBlur}
            // RHF error is shown only after submit; live feedback comes from the field.
            error={
              formState.isSubmitted && fieldState.error
                ? fieldState.error.message
                : undefined
            }
          />
        )}
      />
      <View style={styles.row}>
        <Switch
          value={simulateTaken}
          onValueChange={setSimulateTaken}
          accessibilityLabel="simulate"
        />
        <Text style={[styles.switchLabel, { color: c.text }]}>
          {t(
            'Simuler « numéro déjà utilisé »',
            'Simulate "number already used"'
          )}
        </Text>
      </View>
      <Button
        title={
          loading
            ? t('Envoi…', 'Sending…')
            : t('Créer mon compte', 'Create my account')
        }
        onPress={onSubmit}
        disabled={!formState.isValid || loading}
      />
      {submitted ? (
        <>
          <Note tone="success">
            {t('✓ Compte créé avec :', '✓ Account created with:')}
          </Note>
          <JsonView value={submitted} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  switchLabel: { fontSize: 14, flex: 1 },
});
