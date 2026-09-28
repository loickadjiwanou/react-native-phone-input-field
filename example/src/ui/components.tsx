import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { usePalette } from './DemoContext';

export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const c = usePalette();
  return (
    <View
      style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Text
        accessibilityRole="header"
        style={[styles.cardTitle, { color: c.text }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.cardSubtitle, { color: c.muted }]}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const c = usePalette();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: c.primary }
          : {
              backgroundColor: 'transparent',
              borderColor: c.primary,
              borderWidth: 1,
            },
        (pressed || disabled) && { opacity: disabled ? 0.4 : 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: primary ? c.onPrimary : c.primary },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const c = usePalette();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { borderColor: c.border }]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: c.primary }]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: selected ? c.onPrimary : c.text },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function JsonView({ value }: { value: unknown }) {
  const c = usePalette();
  return (
    <View style={[styles.json, { backgroundColor: c.code }]}>
      <Text selectable style={[styles.jsonText, { color: c.text }]}>
        {JSON.stringify(value, null, 2)}
      </Text>
    </View>
  );
}

export function Note({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'success' | 'error';
}) {
  const c = usePalette();
  const color =
    tone === 'success' ? c.success : tone === 'error' ? c.error : c.muted;
  return <Text style={[styles.note, { color }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardSubtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  cardBody: { marginTop: 16, gap: 12 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segment: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  segmentText: { fontSize: 13, fontWeight: '600' },
  json: { borderRadius: 10, padding: 12 },
  jsonText: { fontFamily: 'Courier', fontSize: 12, lineHeight: 17 },
  note: { fontSize: 14, lineHeight: 20 },
});
