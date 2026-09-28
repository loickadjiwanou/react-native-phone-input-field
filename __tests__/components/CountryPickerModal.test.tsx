import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  CountryPickerModal,
  defaultTheme,
  getCountries,
  getCountry,
  getMessages,
  type CountryPickerModalProps,
} from 'react-native-phone-input-field';

const countries = getCountries('fr');
const base: CountryPickerModalProps = {
  visible: true,
  onClose: jest.fn(),
  onSelect: jest.fn(),
  selected: getCountry('BJ', 'fr'),
  countries,
  theme: defaultTheme,
  messages: getMessages('fr'),
};

async function renderModal(props: Partial<CountryPickerModalProps> = {}) {
  const merged = {
    ...base,
    onClose: jest.fn(),
    onSelect: jest.fn(),
    // Deterministic tests: the list does not wait for the opening animation.
    hideModalContentWhileAnimating: false,
    ...props,
  };
  const utils = await render(<CountryPickerModal {...merged} />);
  return {
    ...utils,
    props: merged,
    list: () => screen.getByTestId('phone-field-country-list'),
  };
}

describe('<CountryPickerModal />', () => {
  it('shows the title, sections and the selected country', async () => {
    const preferred = ['BJ', 'TG', 'CI'].map((c) =>
      getCountry(c as never, 'fr')
    );
    const recent = [getCountry('FR', 'fr'), getCountry('TG', 'fr')];
    const t = await renderModal({
      preferredCountries: preferred,
      recentCountries: recent,
    });
    expect(screen.getByText('Sélectionnez un pays')).toBeOnTheScreen();
    expect(screen.getByText('Pays suggérés')).toBeOnTheScreen();
    expect(screen.getByText('Récents')).toBeOnTheScreen();
    // TG is already suggested: not repeated in recents.
    expect(within(t.list()).getAllByTestId('country-item-TG')).toHaveLength(1);
    expect(
      within(t.list()).getAllByTestId('country-item-BJ')[0]
    ).toBeSelected();
  });

  it('search is accent-insensitive and shows an empty state', async () => {
    const t = await renderModal();
    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      "côte d'iv"
    );
    expect(within(t.list()).getByTestId('country-item-CI')).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      '+229'
    );
    expect(within(t.list()).getAllByTestId(/^country-item-/)[0]).toHaveProp(
      'testID',
      'country-item-BJ'
    );
    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      'zzzz'
    );
    expect(screen.getByText('Aucun pays trouvé')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('phone-field-search-clear'));
    expect(screen.getByTestId('phone-field-search-input')).toHaveDisplayValue(
      ''
    );
  });

  it('selects a country', async () => {
    const t = await renderModal();
    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      'togo'
    );
    await fireEvent.press(within(t.list()).getByTestId('country-item-TG'));
    expect(t.props.onSelect).toHaveBeenCalledWith('TG');
  });

  it('closes with ✕, the backdrop and the Android back button', async () => {
    const t = await renderModal();
    await fireEvent.press(screen.getByTestId('phone-field-picker-close'));
    await fireEvent.press(screen.getByTestId('phone-field-picker-backdrop'));
    await fireEvent(
      screen.getByTestId('phone-field-country-picker'),
      'requestClose'
    );
    expect(t.props.onClose).toHaveBeenCalledTimes(3);
  });

  it('defers the list until the opening animation ends', async () => {
    await render(<CountryPickerModal {...base} />);
    expect(screen.queryByTestId('phone-field-country-list')).toBeNull();
    expect(screen.getByText('Sélectionnez un pays')).toBeOnTheScreen();
    expect(
      await screen.findByTestId('phone-field-country-list')
    ).toBeOnTheScreen();
  });

  it('hideModalContentWhileAnimating={false} renders the list at once', async () => {
    await render(
      <CountryPickerModal {...base} hideModalContentWhileAnimating={false} />
    );
    expect(screen.getByTestId('phone-field-country-list')).toBeOnTheScreen();
  });

  it('onBackdropPress is called, and closes unless disabled', async () => {
    const onBackdropPress = jest.fn();
    const t = await renderModal({ onBackdropPress });
    await fireEvent.press(screen.getByTestId('phone-field-picker-backdrop'));
    expect(onBackdropPress).toHaveBeenCalledTimes(1);
    expect(t.props.onClose).toHaveBeenCalledTimes(1);
    await t.unmount();
    const onlyCallback = await renderModal({
      onBackdropPress,
      closeOnBackdropPress: false,
    });
    await fireEvent.press(screen.getByTestId('phone-field-picker-backdrop'));
    expect(onBackdropPress).toHaveBeenCalledTimes(2);
    expect(onlyCallback.props.onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['fadeInUp', 'fadeOutDown'],
    ['slideInUp', 'slideOutDown'],
    ['fadeIn', 'fadeOut'],
    ['zoomIn', 'zoomOut'],
  ] as const)('animates with %s / %s', async (animationIn, animationOut) => {
    const utils = await renderModal({
      animationIn,
      animationOut,
      animationInTiming: 10,
      animationOutTiming: 10,
    });
    const onClosed = jest.fn();
    await utils.rerender(
      <CountryPickerModal
        {...base}
        visible={false}
        animationIn={animationIn}
        animationOut={animationOut}
        animationOutTiming={10}
        backdropTransitionOutTiming={10}
        onClosed={onClosed}
      />
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalled());
  });

  it('opens on the selected country and keeps the Android navigation bar', async () => {
    await renderModal({ selected: getCountry('ZW', 'fr') });
    expect(
      screen.getByTestId('phone-field-country-list').props.initialScrollIndex
    ).toBeGreaterThan(200);
    expect(
      screen.getByTestId('phone-field-country-picker').props
        .navigationBarTranslucent
    ).toBe(true);
  });

  it('keeps the list unchanged while closing', async () => {
    const props = { ...base, hideModalContentWhileAnimating: false };
    const utils = await render(<CountryPickerModal {...props} />);
    const list = () => screen.getByTestId('phone-field-country-list');
    expect(within(list()).getByTestId('country-item-BJ')).toBeSelected();
    // The parent switches the selection as the sheet starts closing.
    await utils.rerender(
      <CountryPickerModal
        {...props}
        visible={false}
        selected={getCountry('TG', 'fr')}
      />
    );
    expect(within(list()).getByTestId('country-item-BJ')).toBeSelected();
  });

  it('closeOnBackdropPress={false}', async () => {
    const t = await renderModal({ closeOnBackdropPress: false });
    await fireEvent.press(
      screen.getByTestId('phone-field-picker-backdrop', {
        includeHiddenElements: true,
      })
    );
    expect(t.props.onClose).not.toHaveBeenCalled();
  });

  it('unmounts after the closing animation and calls onClosed', async () => {
    jest.useFakeTimers();
    try {
      const onClosed = jest.fn();
      const utils = await render(
        <CountryPickerModal {...base} onClosed={onClosed} />
      );
      await utils.rerender(
        <CountryPickerModal {...base} visible={false} onClosed={onClosed} />
      );
      await act(async () => {
        jest.advanceTimersByTime(500);
      });
      expect(onClosed).toHaveBeenCalled();
      expect(screen.queryByTestId('phone-field-country-list')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('alphabet index jumps to sections', async () => {
    await renderModal({ showAlphabetIndex: true });
    const index = screen.getByTestId('phone-field-alphabet-index');
    expect(within(index).getByTestId('alphabet-letter-Z')).toBeOnTheScreen();
    await fireEvent.press(within(index).getByTestId('alphabet-letter-Z'));
  });

  it('every part can be replaced', async () => {
    await renderModal({
      renderHeader: ({ title }) => <Text>header:{title}</Text>,
      renderSearchBar: ({ placeholder }) => <Text>search:{placeholder}</Text>,
      renderCountryItem: ({ country, selected }) => (
        <Text key={country.iso2}>
          item:{country.iso2}:{selected ? 'yes' : 'no'}
        </Text>
      ),
      title: 'Pays',
      searchPlaceholder: 'Chercher',
    });
    expect(screen.getByText('header:Pays')).toBeOnTheScreen();
    expect(screen.getByText('search:Chercher')).toBeOnTheScreen();
    expect(screen.getAllByText(/^item:/).length).toBeGreaterThan(5);
  });

  it('custom empty state', async () => {
    await renderModal({ renderEmpty: (q) => <Text>rien pour {q}</Text> });
    await fireEvent.changeText(
      screen.getByTestId('phone-field-search-input'),
      'zzzz'
    );
    expect(screen.getByText('rien pour zzzz')).toBeOnTheScreen();
  });

  it.each(['bottomSheet', 'fullScreen', 'center'] as const)(
    'renders the %s presentation',
    async (presentation) => {
      await renderModal({ presentation });
      expect(screen.getByTestId('phone-field-country-list')).toBeOnTheScreen();
    }
  );
});
