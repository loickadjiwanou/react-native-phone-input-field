import { render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import {
  Flag,
  getDeviceCountry,
  StatusIcon,
} from 'react-native-phone-input-field';

import { fallbackInsets } from '../../src/utils/safeArea';

describe('<Flag />', () => {
  it('renders the emoji', async () => {
    await render(<Flag iso2="BJ" />);
    expect(
      screen.getByTestId('flag-BJ', { includeHiddenElements: true })
    ).toHaveTextContent('🇧🇯');
  });

  it('falls back on an ISO badge for non-RGI flags or when forced', async () => {
    await render(<Flag iso2="XK" />);
    expect(
      screen.getByTestId('flag-fallback-XK', { includeHiddenElements: true })
    ).toHaveTextContent('XK');
    await render(<Flag iso2="FR" forceFallback />);
    expect(
      screen.getByTestId('flag-fallback-FR', { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it('StatusIcon glyphs', async () => {
    await render(<StatusIcon kind="valid" color="green" />);
    expect(
      screen.getByTestId('status-icon-valid', { includeHiddenElements: true })
    ).toHaveTextContent('✓');
  });
});

describe('device country', () => {
  it('reads the locale (Intl / native modules)', () => {
    const country = getDeviceCountry();
    expect(country === null || /^[A-Z]{2}$/.test(country)).toBe(true);
  });

  it('uses expo-localization when installed', () => {
    jest.isolateModules(() => {
      jest.doMock(
        'expo-localization',
        () => ({ getLocales: () => [{ regionCode: 'CI' }] }),
        { virtual: true }
      );
      require('../../src/core/setupMax');
      const { getDeviceCountry: fresh } =
        require('../../src/hooks/useDefaultCountry') as {
          getDeviceCountry: () => string | null;
        };
      expect(fresh()).toBe('CI');
    });
  });

  it('uses the language tag when expo-localization has no region', () => {
    jest.isolateModules(() => {
      jest.doMock(
        'expo-localization',
        () => ({
          getLocales: () => [{ regionCode: null, languageTag: 'fr-SN' }],
        }),
        {
          virtual: true,
        }
      );
      require('../../src/core/setupMax');
      const { getDeviceCountry: fresh } =
        require('../../src/hooks/useDefaultCountry') as {
          getDeviceCountry: () => string | null;
        };
      expect(fresh()).toBe('SN');
    });
  });
});

describe('safe area fallback', () => {
  it('returns platform insets', () => {
    const insets = fallbackInsets();
    expect(insets).toEqual(expect.objectContaining({ left: 0, right: 0 }));
    expect(Platform.OS === 'ios' ? insets.top >= 20 : insets.top >= 0).toBe(
      true
    );
  });
});
