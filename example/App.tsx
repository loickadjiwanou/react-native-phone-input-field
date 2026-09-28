import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PhoneFieldThemeProvider } from 'react-native-phone-input-field';

import { BasicDemo } from './src/demos/BasicDemo';
import { CustomDemo } from './src/demos/CustomDemo';
import { HeadlessDemo } from './src/demos/HeadlessDemo';
import { OtpDemo } from './src/demos/OtpDemo';
import { SignupDemo } from './src/demos/SignupDemo';
import { Segmented } from './src/ui/components';
import {
  DemoContext,
  palette,
  type DemoSettings,
  type Locale,
} from './src/ui/DemoContext';

const DEMOS = [
  { key: 'basic', fr: 'Basique', en: 'Basic', Component: BasicDemo },
  { key: 'signup', fr: 'Inscription', en: 'Sign-up', Component: SignupDemo },
  { key: 'otp', fr: 'Mobile (OTP)', en: 'Mobile (OTP)', Component: OtpDemo },
  {
    key: 'custom',
    fr: 'Ultra-custom',
    en: 'Ultra-custom',
    Component: CustomDemo,
  },
  { key: 'headless', fr: 'Headless', en: 'Headless', Component: HeadlessDemo },
] as const;

type DemoKey = (typeof DEMOS)[number]['key'];

export default function App() {
  const [settings, setSettings] = useState<DemoSettings>({
    dark: false,
    locale: 'fr',
    rtl: false,
  });
  const [demo, setDemo] = useState<DemoKey>('basic');
  const c = settings.dark ? palette.dark : palette.light;
  const t = (fr: string, en: string) => (settings.locale === 'fr' ? fr : en);
  const Active = DEMOS.find((d) => d.key === demo)!.Component;

  return (
    <SafeAreaProvider>
      <DemoContext.Provider value={settings}>
        <PhoneFieldThemeProvider
          colorScheme={settings.dark ? 'dark' : 'light'}
          locale={settings.locale}
        >
          <StatusBar style={settings.dark ? 'light' : 'dark'} />
          <SafeAreaView
            edges={['top', 'left', 'right']}
            style={[styles.root, { backgroundColor: c.background }]}
          >
            {/* `direction` mirrors the layout without reloading the app. */}
            <View
              style={[styles.root, { direction: settings.rtl ? 'rtl' : 'ltr' }]}
            >
              <View
                style={[
                  styles.header,
                  { borderColor: c.border, backgroundColor: c.card },
                ]}
              >
                <Text style={[styles.title, { color: c.text }]}>
                  react-native-phone-input-field
                </Text>
                <View style={styles.toggles}>
                  <Segmented
                    label={t('Thème', 'Theme')}
                    value={settings.dark ? 'dark' : 'light'}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, dark: v === 'dark' }))
                    }
                    options={[
                      { value: 'light', label: t('☀︎ Clair', '☀︎ Light') },
                      { value: 'dark', label: t('☾ Sombre', '☾ Dark') },
                    ]}
                  />
                  <Segmented<Locale>
                    label={t('Langue', 'Language')}
                    value={settings.locale}
                    onChange={(locale) =>
                      setSettings((s) => ({ ...s, locale }))
                    }
                    options={[
                      { value: 'fr', label: 'FR' },
                      { value: 'en', label: 'EN' },
                    ]}
                  />
                  <Segmented
                    label="RTL"
                    value={settings.rtl ? 'rtl' : 'ltr'}
                    onChange={(v) =>
                      setSettings((s) => ({ ...s, rtl: v === 'rtl' }))
                    }
                    options={[
                      { value: 'ltr', label: 'LTR' },
                      { value: 'rtl', label: 'RTL' },
                    ]}
                  />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tabs}
                >
                  {DEMOS.map((d) => {
                    const selected = d.key === demo;
                    return (
                      <Pressable
                        key={d.key}
                        accessibilityRole="tab"
                        accessibilityState={{ selected }}
                        onPress={() => setDemo(d.key)}
                        style={[
                          styles.tab,
                          { borderColor: selected ? c.primary : c.border },
                          selected && { backgroundColor: c.primary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            { color: selected ? c.onPrimary : c.text },
                          ]}
                        >
                          {settings.locale === 'fr' ? d.fr : d.en}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets
              >
                {/* Remount on language change so demos pick up the new texts. */}
                <Active key={`${demo}-${settings.locale}`} />
              </ScrollView>
            </View>
          </SafeAreaView>
        </PhoneFieldThemeProvider>
      </DemoContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '800' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 48 },
});
