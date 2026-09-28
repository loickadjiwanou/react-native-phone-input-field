import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useCountrySearch,
  usePhoneField,
  type Country,
} from 'react-native-phone-input-field';

import { Card, JsonView } from '../ui/components';
import { useDemo, usePalette, useT } from '../ui/DemoContext';

/** Demo 5: a completely different UI built on the headless hook. */
export function HeadlessDemo() {
  const t = useT();
  const { locale } = useDemo();
  const c = usePalette();
  const field = usePhoneField({
    defaultCountry: 'BJ',
    preferredCountries: ['BJ', 'TG', 'CI', 'SN', 'FR'],
    locale,
    required: true,
  });
  const search = useCountrySearch(field.countries);

  const stateColor = field.errorVisible
    ? c.error
    : field.state === 'valid'
      ? c.success
      : field.isFocused
        ? c.primary
        : c.border;

  return (
    <Card
      title="Headless"
      subtitle={t(
        'Aucune UI de la librairie : juste usePhoneField et useCountrySearch. Le sélecteur de pays est une liste inline.',
        'No library UI: just usePhoneField and useCountrySearch. The country picker is an inline list.'
      )}
    >
      <View style={styles.chips}>
        {field.preferredCountries.map((country) => (
          <Chip
            key={country.iso2}
            country={country}
            selected={country.iso2 === field.country.iso2}
            onPress={() => field.setCountry(country.iso2)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={field.isPickerOpen ? field.closePicker : field.openPicker}
          style={[styles.chip, { borderColor: c.border }]}
        >
          <Text style={{ color: c.text }}>
            {field.isPickerOpen
              ? t('Fermer', 'Close')
              : t('Autres…', 'Others…')}
          </Text>
        </Pressable>
      </View>

      {field.isPickerOpen ? (
        <View style={[styles.picker, { borderColor: c.border }]}>
          <TextInput
            value={search.query}
            onChangeText={search.setQuery}
            placeholder={field.messages.searchPlaceholder}
            placeholderTextColor={c.muted}
            style={[styles.search, { color: c.text, borderColor: c.border }]}
          />
          <FlatList
            data={search.results}
            keyExtractor={(item) => item.iso2}
            style={styles.list}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => field.selectCountry(item.iso2)}
                style={styles.item}
              >
                <Text style={{ color: c.text }}>
                  {item.flag} {item.name}{' '}
                  <Text style={{ color: c.muted }}>+{item.callingCode}</Text>
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <View style={[styles.display, { borderColor: stateColor }]}>
        <Text style={[styles.prefix, { color: c.muted }]}>
          {field.country.flag} +{field.country.callingCode}
        </Text>
        <TextInput
          ref={field.inputRef}
          value={field.text}
          onChangeText={field.onChangeText}
          onFocus={field.onFocus}
          onBlur={field.onBlur}
          onSelectionChange={field.onSelectionChange}
          selection={field.selection}
          placeholder={field.placeholder}
          placeholderTextColor={c.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          accessibilityLabel={field.messages.inputLabel}
          style={[styles.bigInput, { color: c.text }]}
        />
      </View>
      <Text style={{ color: stateColor, fontWeight: '600' }}>
        {field.errorMessage ??
          (field.state === 'valid'
            ? `✓ ${field.value.e164}`
            : `state: ${field.state}`)}
      </Text>
      <JsonView
        value={{
          state: field.state,
          error: field.error,
          e164: field.value.e164,
          type: field.value.type,
        }}
      />
    </Card>
  );
}

function Chip({
  country,
  selected,
  onPress,
}: {
  country: Country;
  selected: boolean;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={country.name}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? c.primary : c.border },
        selected && { backgroundColor: c.primary },
      ]}
    >
      <Text style={{ color: selected ? c.onPrimary : c.text }}>
        {country.flag} {country.iso2}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  picker: { borderWidth: 1, borderRadius: 12, padding: 8, gap: 8 },
  search: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  list: { maxHeight: 220 },
  item: { paddingVertical: 10, paddingHorizontal: 4 },
  display: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 16,
    minHeight: 72,
    gap: 12,
  },
  prefix: { fontSize: 22, fontWeight: '600' },
  bigInput: { flex: 1, fontSize: 26, fontWeight: '700', letterSpacing: 1 },
});
