import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  PixelRatio,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type SectionListData,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { normalizeSearchText } from '../core/normalize';
import { useCountrySearch } from '../hooks/useCountrySearch';
import { interpolate, type Messages } from '../i18n';
import type { PhoneFieldTheme } from '../theme/types';
import type { Country, CountryCode, ViewRef } from '../types';
import { useSafeInsets } from '../utils/safeArea';
import { CountryListItem } from './CountryListItem';
import type { RenderFlag } from './Flag';
import { SearchBar } from './SearchBar';

export type ModalPresentation = 'bottomSheet' | 'fullScreen' | 'center';

/** Style overrides of every part of the picker. */
export interface ModalStyles {
  backdrop?: StyleProp<ViewStyle>;
  container?: StyleProp<ViewStyle>;
  header?: StyleProp<ViewStyle>;
  handle?: StyleProp<ViewStyle>;
  title?: StyleProp<TextStyle>;
  closeButton?: StyleProp<ViewStyle>;
  closeIcon?: StyleProp<TextStyle>;
  searchContainer?: StyleProp<ViewStyle>;
  searchInput?: StyleProp<TextStyle>;
  list?: StyleProp<ViewStyle>;
  listContent?: StyleProp<ViewStyle>;
  sectionHeader?: StyleProp<ViewStyle>;
  sectionHeaderText?: StyleProp<TextStyle>;
  item?: StyleProp<ViewStyle>;
  itemSelected?: StyleProp<ViewStyle>;
  itemName?: StyleProp<TextStyle>;
  itemCallingCode?: StyleProp<TextStyle>;
  empty?: StyleProp<ViewStyle>;
  emptyText?: StyleProp<TextStyle>;
  alphabetIndex?: StyleProp<ViewStyle>;
  alphabetLetter?: StyleProp<TextStyle>;
}

/** Contract of `renderModal`: plug any bottom sheet (Gorhom…). */
export interface CountryPickerRenderProps {
  visible: boolean;
  onClose: () => void;
  /** Allowed countries, sorted by name. */
  countries: Country[];
  onSelect: (code: CountryCode) => void;
  selected: Country;
  preferredCountries: Country[];
  recentCountries: Country[];
  messages: Messages;
  theme: PhoneFieldTheme;
}

export interface RenderCountryItemInfo {
  country: Country;
  selected: boolean;
  onSelect: (code: CountryCode) => void;
  height: number;
}

export interface RenderSearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

export interface RenderModalHeaderProps {
  title: string;
  onClose: () => void;
}

export type ModalAnimationIn = 'fadeInUp' | 'slideInUp' | 'fadeIn' | 'zoomIn';
export type ModalAnimationOut =
  'fadeOutDown' | 'slideOutDown' | 'fadeOut' | 'zoomOut';

/**
 * Open / close animation of the picker. Same names and meaning as
 * `react-native-modal`, without the dependency. Every animation runs on the
 * native driver.
 */
export interface ModalAnimationProps {
  /** Default `'fadeInUp'`. */
  animationIn?: ModalAnimationIn;
  /** Default `'fadeOutDown'`. */
  animationOut?: ModalAnimationOut;
  /** Default `450` ms. */
  animationInTiming?: number;
  /** Default `300` ms. */
  animationOutTiming?: number;
  /** Default `450` ms. */
  backdropTransitionInTiming?: number;
  /** Default `300` ms. */
  backdropTransitionOutTiming?: number;
  /** Opacity of `colors.overlay` once shown. Default `0.4`. */
  backdropOpacity?: number;
  /** Called on backdrop press (before closing when `closeOnBackdropPress`). */
  onBackdropPress?: () => void;
  /**
   * Mount the country list only once the opening animation is over, so the
   * animation never competes with rendering rows. Default `true`.
   */
  hideModalContentWhileAnimating?: boolean;
  /** Swipe the sheet down to close it. Default `true`. */
  swipeToClose?: boolean;
}

export interface CountryPickerModalProps extends ModalAnimationProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (code: CountryCode) => void;
  selected: Country;
  countries: Country[];
  preferredCountries?: Country[];
  recentCountries?: Country[];
  theme: PhoneFieldTheme;
  messages: Messages;
  presentation?: ModalPresentation;
  title?: string;
  searchPlaceholder?: string;
  /** Focus the search field when the picker opens. Default `false`. */
  autoFocusSearch?: boolean;
  showAlphabetIndex?: boolean;
  /** Close when tapping outside the sheet. Default `true`. */
  closeOnBackdropPress?: boolean;
  styles?: ModalStyles;
  flagSize?: number;
  renderFlag?: RenderFlag;
  renderCountryItem?: (info: RenderCountryItemInfo) => ReactNode;
  renderSearchBar?: (props: RenderSearchBarProps) => ReactNode;
  renderHeader?: (props: RenderModalHeaderProps) => ReactNode;
  renderEmpty?: (query: string) => ReactNode;
  /** Called once the closing animation is over. */
  onClosed?: () => void;
  testID?: string;
}

interface PickerSection {
  key: string;
  title: string | null;
  /** Letter shown in the alphabet index. */
  indexLetter?: string;
  data: Country[];
}

const SECTION_HEADER_HEIGHT = 32;
// Stable defaults: a fresh `[]` / `{}` per render would rebuild every section
// and re-render every visible row on each render of the picker.
const NO_COUNTRIES: Country[] = [];
const NO_STYLES: ModalStyles = {};
/** Distance travelled by fadeInUp / fadeOutDown (react-native-animatable uses 100). */
const FADE_OFFSET = 100;
/** CSS "ease", the curve react-native-modal animations use. */
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
/** Opening curve: starts briskly and settles gently at the top. */
const EASE_OUT = Easing.out(Easing.cubic);
/** Fallback when `Modal#onShow` is not reported by the platform. */
const SHOW_FALLBACK_MS = 300;

/** Returns `value`, except while `frozen` where the last unfrozen value is kept. */
function useFrozenWhile<T>(value: T, frozen: boolean): T {
  const ref = useRef(value);
  if (!frozen) ref.current = value;
  return ref.current;
}

function firstLetter(name: string): string {
  const letter = normalizeSearchText(name).charAt(0).toUpperCase();
  return /[A-Z]/.test(letter) ? letter : '#';
}

/** Offsets of every flattened SectionList cell (header, items, footer per section). */
function buildLayout(
  sections: PickerSection[],
  rowHeight: number,
  headerHeight: number
) {
  const lengths: number[] = [];
  const offsets: number[] = [];
  let offset = 0;
  const push = (length: number) => {
    lengths.push(length);
    offsets.push(offset);
    offset += length;
  };
  for (const section of sections) {
    push(section.title ? headerHeight : 0);
    for (let i = 0; i < section.data.length; i += 1) push(rowHeight);
    push(0);
  }
  return { lengths, offsets };
}

/**
 * Country picker: bottom sheet (≈90% of the screen), full screen or centered
 * card. Search, suggested / recent countries, sticky A–Z sections, optional
 * alphabet index, swipe to close, keyboard aware.
 */
export const CountryPickerModal = memo(function CountryPickerModal({
  visible,
  onClose,
  onSelect,
  selected,
  countries,
  preferredCountries = NO_COUNTRIES,
  recentCountries = NO_COUNTRIES,
  theme,
  messages,
  presentation = 'bottomSheet',
  title,
  searchPlaceholder,
  autoFocusSearch = false,
  showAlphabetIndex = false,
  closeOnBackdropPress = true,
  swipeToClose = true,
  animationIn = 'fadeInUp',
  animationOut = 'fadeOutDown',
  animationInTiming = 450,
  animationOutTiming = 300,
  backdropTransitionInTiming = 450,
  backdropTransitionOutTiming = 300,
  backdropOpacity = 0.4,
  onBackdropPress,
  hideModalContentWhileAnimating = true,
  styles: custom = NO_STYLES,
  flagSize = 24,
  renderFlag,
  renderCountryItem,
  renderSearchBar,
  renderHeader,
  renderEmpty,
  onClosed,
  testID = 'phone-field-country-picker',
}: CountryPickerModalProps) {
  const { colors, spacing } = theme;
  const insets = useSafeInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const fontScale = Math.min(Math.max(PixelRatio.getFontScale(), 1), 1.8);
  const rowHeight = Math.round(theme.countryItemHeight * fontScale);
  const headerHeight = Math.round(SECTION_HEADER_HEIGHT * fontScale);

  const { query, setQuery, results, isSearching } = useCountrySearch(countries);

  // ── Open / close animation (native driver) ───────────────────────────
  const [mounted, setMounted] = useState(visible);
  const [closing, setClosing] = useState(false);
  const [listReady, setListReady] = useState(!hideModalContentWhileAnimating);
  const content = useRef(new Animated.Value(0)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;

  // Latest timings / callbacks without restarting the effect.
  const animRef = useRef({
    animationInTiming,
    animationOutTiming,
    backdropTransitionInTiming,
    backdropTransitionOutTiming,
    hideModalContentWhileAnimating,
    onClosed,
  });
  animRef.current = {
    animationInTiming,
    animationOutTiming,
    backdropTransitionInTiming,
    backdropTransitionOutTiming,
    hideModalContentWhileAnimating,
    onClosed,
  };

  // The opening animation starts once the native modal window is on screen
  // (`onShow`): started earlier, part of it would play while the window is
  // still appearing and the sheet would seem to jump out of the bottom.
  const openRef = useRef<{
    started: boolean;
    animation?: Animated.CompositeAnimation;
  }>({
    started: true,
  });
  const startOpening = useCallback(() => {
    const state = openRef.current;
    if (state.started) return;
    state.started = true;
    const cfg = animRef.current;
    const animation = Animated.parallel([
      Animated.timing(content, {
        toValue: 1,
        duration: cfg.animationInTiming,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.timing(backdrop, {
        toValue: 1,
        duration: cfg.backdropTransitionInTiming,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]);
    state.animation = animation;
    animation.start(({ finished }) => {
      if (finished) setListReady(true);
    });
  }, [content, backdrop]);

  useEffect(() => {
    const cfg = animRef.current;
    if (visible) {
      setMounted(true);
      setClosing(false);
      drag.setValue(0);
      if (cfg.hideModalContentWhileAnimating) setListReady(false);
      openRef.current = { started: false };
      const fallback = setTimeout(startOpening, SHOW_FALLBACK_MS);
      return () => {
        clearTimeout(fallback);
        openRef.current.animation?.stop();
      };
    }
    openRef.current.started = true; // never open after a close request
    setClosing(true);
    const run = (value: Animated.Value, duration: number) =>
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: EASE,
        useNativeDriver: true,
      });
    const animation = Animated.parallel([
      run(content, cfg.animationOutTiming),
      run(backdrop, cfg.backdropTransitionOutTiming),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      setClosing(false);
      setQuery('');
      animRef.current.onClosed?.();
    });
    return () => animation.stop();
  }, [visible, content, backdrop, drag, setQuery, startOpening]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          swipeToClose && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 120 || g.vy > 1.2) {
            onClose();
          } else {
            Animated.spring(drag, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () =>
          Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [drag, onClose, swipeToClose]
  );

  // ── Sections ─────────────────────────────────────────────────────────
  const liveSections = useMemo<PickerSection[]>(() => {
    if (isSearching) {
      // No section at all when nothing matches, so ListEmptyComponent shows.
      return results.length > 0
        ? [{ key: 'results', title: null, data: results }]
        : [];
    }
    const out: PickerSection[] = [];
    if (preferredCountries.length > 0) {
      out.push({
        key: 'preferred',
        title: messages.preferredSection,
        data: preferredCountries,
      });
    }
    const preferredSet = new Set(preferredCountries.map((c) => c.iso2));
    const recents = recentCountries.filter((c) => !preferredSet.has(c.iso2));
    if (recents.length > 0) {
      out.push({ key: 'recent', title: messages.recentSection, data: recents });
    }
    const byLetter = new Map<string, Country[]>();
    for (const country of countries) {
      const letter = firstLetter(country.name);
      const bucket = byLetter.get(letter);
      if (bucket) bucket.push(country);
      else byLetter.set(letter, [country]);
    }
    for (const [letter, data] of byLetter) {
      out.push({
        key: `letter-${letter}`,
        title: letter,
        indexLetter: letter,
        data,
      });
    }
    return out;
  }, [
    isSearching,
    results,
    preferredCountries,
    recentCountries,
    countries,
    messages,
  ]);

  // Once a country is picked the parent updates the selection and the
  // recents while the sheet is closing: keep showing what was on screen so
  // no row re-renders during the closing animation.
  const sections = useFrozenWhile(liveSections, !visible);
  const selectedIso = useFrozenWhile(selected.iso2, !visible);

  const layout = useMemo(
    () => buildLayout(sections, rowHeight, headerHeight),
    [sections, rowHeight, headerHeight]
  );
  const getItemLayout = useCallback(
    (_data: unknown, index: number) => ({
      length: layout.lengths[index] ?? rowHeight,
      offset: layout.offsets[index] ?? 0,
      index,
    }),
    [layout, rowHeight]
  );

  // ── Scrolling ────────────────────────────────────────────────────────
  const listRef = useRef<SectionList<Country, PickerSection>>(null);

  const scrollToSection = useCallback(
    (
      sectionIndex: number,
      itemIndex = 0,
      animated = false,
      viewPosition = 0
    ) => {
      try {
        listRef.current?.scrollToLocation({
          sectionIndex,
          itemIndex,
          animated,
          viewPosition,
          viewOffset: 0,
        });
      } catch {
        // Out of range while the list is re-rendering: ignore.
      }
    },
    []
  );

  // The list starts on the selected country (no visible jump after mount).
  const initialScrollIndex = useMemo(() => {
    if (isSearching) return undefined;
    // Already visible at the top (suggested / recent): start at the top.
    const pinned = sections.some(
      (section) =>
        section.indexLetter === undefined &&
        section.data.some((c) => c.iso2 === selected.iso2)
    );
    if (pinned) return undefined;
    let flat = 0;
    for (const section of sections) {
      const i =
        section.indexLetter !== undefined
          ? section.data.findIndex((c) => c.iso2 === selected.iso2)
          : -1;
      if (i >= 0) {
        // +1 for the section header; keep a few rows above for context.
        return Math.max(0, flat + 1 + i - 3);
      }
      flat += section.data.length + 2;
    }
    return undefined;
    // Computed when the list mounts only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listReady]);

  // Fade the list in when it is mounted after the opening animation.
  const listOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!listReady || !hideModalContentWhileAnimating) return;
    listOpacity.setValue(0);
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: 180,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  }, [listReady, hideModalContentWhileAnimating, listOpacity]);

  const letters = useMemo(
    () =>
      sections
        .map((s, index) => ({ letter: s.indexLetter, index }))
        .filter(
          (l): l is { letter: string; index: number } => l.letter !== undefined
        ),
    [sections]
  );

  // ── Rendering ────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Country }) => {
      const isSelected = item.iso2 === selectedIso;
      if (renderCountryItem) {
        return (
          <>
            {renderCountryItem({
              country: item,
              selected: isSelected,
              onSelect,
              height: rowHeight,
            })}
          </>
        );
      }
      return (
        <CountryListItem
          country={item}
          selected={isSelected}
          onSelect={onSelect}
          height={rowHeight}
          theme={theme}
          messages={messages}
          flagSize={flagSize}
          renderFlag={renderFlag}
          style={custom.item}
          selectedStyle={custom.itemSelected}
          nameStyle={custom.itemName}
          callingCodeStyle={custom.itemCallingCode}
        />
      );
    },
    [
      selectedIso,
      renderCountryItem,
      onSelect,
      rowHeight,
      theme,
      messages,
      flagSize,
      renderFlag,
      custom.item,
      custom.itemSelected,
      custom.itemName,
      custom.itemCallingCode,
    ]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionListData<Country, PickerSection> }) =>
      section.title ? (
        <View
          style={[
            styles.sectionHeader,
            {
              height: headerHeight,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
            },
            custom.sectionHeader,
          ]}
          accessibilityRole="header"
        >
          <Text
            style={[
              styles.sectionHeaderText,
              {
                color: colors.textSecondary,
                fontSize: theme.fontSizes.sectionHeader,
                fontFamily: theme.fontFamily.bold,
              },
              custom.sectionHeaderText,
            ]}
          >
            {section.title}
          </Text>
        </View>
      ) : null,
    [
      headerHeight,
      colors,
      spacing.lg,
      theme.fontSizes.sectionHeader,
      theme.fontFamily.bold,
      custom.sectionHeader,
      custom.sectionHeaderText,
    ]
  );

  // SectionList prefixes item keys with the section key: the ISO code is
  // unique per section, and rows are reused (not remounted) while filtering.
  const keyExtractor = useCallback((item: Country) => item.iso2, []);

  const headerTitle = title ?? messages.modalTitle;
  const placeholder = searchPlaceholder ?? messages.searchPlaceholder;

  const empty = (
    <View style={[styles.empty, { padding: spacing.xl }, custom.empty]}>
      {renderEmpty ? (
        renderEmpty(query)
      ) : (
        <Text
          style={[
            styles.emptyText,
            {
              color: colors.textSecondary,
              fontFamily: theme.fontFamily.regular,
            },
            custom.emptyText,
          ]}
        >
          {messages.noResults}
        </Text>
      )}
    </View>
  );

  // ── Container geometry ───────────────────────────────────────────────
  const isSheet = presentation === 'bottomSheet';
  const isCenter = presentation === 'center';
  const containerStyle: ViewStyle = isSheet
    ? {
        height: screenHeight * 0.9,
        borderTopLeftRadius: theme.radius.modal,
        borderTopRightRadius: theme.radius.modal,
        paddingBottom: insets.bottom,
      }
    : isCenter
      ? {
          width: Math.min(440, screenWidth - 32),
          height: Math.min(screenHeight * 0.75, 640),
          borderRadius: theme.radius.modal,
          alignSelf: 'center',
        }
      : { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom };

  // Opening uses animationIn, closing uses animationOut.
  const kind = closing ? animationOut : animationIn;
  const isSlide = kind === 'slideInUp' || kind === 'slideOutDown';
  const travel = isSlide
    ? screenHeight
    : kind === 'fadeInUp' || kind === 'fadeOutDown'
      ? FADE_OFFSET
      : 0;
  // Animated nodes are created once per configuration, not on every render
  // (each new node is re-attached to the native animation graph).
  const animatedStyle = useMemo(
    () => ({
      opacity: isSlide ? 1 : content,
      transform: [
        {
          translateY: Animated.add(
            content.interpolate({
              inputRange: [0, 1],
              outputRange: [travel, 0],
            }),
            drag
          ),
        },
        {
          scale:
            kind === 'zoomIn' || kind === 'zoomOut'
              ? content.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                })
              : 1,
        },
      ],
    }),
    [content, drag, kind, isSlide, travel]
  );
  const backdropStyleOpacity = useMemo(
    () =>
      backdrop.interpolate({
        inputRange: [0, 1],
        outputRange: [0, backdropOpacity],
      }),
    [backdrop, backdropOpacity]
  );
  const backdropPressable = closeOnBackdropPress || !!onBackdropPress;
  const handleBackdropPress = () => {
    onBackdropPress?.();
    if (closeOnBackdropPress) onClose();
  };

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={onClose}
      onShow={startOpening}
      statusBarTranslucent
      // Without this the modal's own window repaints the Android navigation bar.
      navigationBarTranslucent
      supportedOrientations={[
        'portrait',
        'landscape',
        'landscape-left',
        'landscape-right',
        'portrait-upside-down',
      ]}
      testID={testID}
    >
      <View style={[styles.root, isCenter && styles.rootCenter]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.overlay, opacity: backdropStyleOpacity },
            custom.backdrop,
          ]}
        >
          <Pressable
            testID="phone-field-picker-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={backdropPressable ? handleBackdropPress : undefined}
            accessibilityRole="button"
            accessibilityLabel={messages.close}
            importantForAccessibility={
              backdropPressable ? 'yes' : 'no-hide-descendants'
            }
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={isCenter ? styles.kavCenter : styles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.container,
              { backgroundColor: colors.background },
              containerStyle,
              animatedStyle,
              custom.container,
            ]}
          >
            <View {...(isSheet ? panResponder.panHandlers : {})}>
              {isSheet ? (
                <View style={styles.handleArea}>
                  <View
                    style={[
                      styles.handle,
                      { backgroundColor: colors.separator },
                      custom.handle,
                    ]}
                  />
                </View>
              ) : null}
              {renderHeader ? (
                renderHeader({ title: headerTitle, onClose })
              ) : (
                <View
                  style={[
                    styles.header,
                    {
                      paddingHorizontal: spacing.lg,
                      paddingTop: isSheet ? spacing.xs : spacing.lg,
                      paddingBottom: spacing.md,
                    },
                    custom.header,
                  ]}
                >
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      {
                        color: colors.text,
                        fontSize: theme.fontSizes.modalTitle,
                        fontFamily: theme.fontFamily.bold,
                      },
                      custom.title,
                    ]}
                  >
                    {headerTitle}
                  </Text>
                  <Pressable
                    testID="phone-field-picker-close"
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={messages.close}
                    hitSlop={12}
                    style={[
                      styles.closeButton,
                      { backgroundColor: colors.surface },
                      custom.closeButton,
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.closeIcon,
                        { color: colors.text },
                        custom.closeIcon,
                      ]}
                    >
                      ✕
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.sm,
              }}
            >
              {renderSearchBar ? (
                renderSearchBar({
                  value: query,
                  onChangeText: setQuery,
                  placeholder,
                })
              ) : (
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder={placeholder}
                  autoFocus={autoFocusSearch}
                  theme={theme}
                  messages={messages}
                  style={custom.searchContainer}
                  inputStyle={custom.searchInput}
                />
              )}
            </View>
            <View style={styles.listArea}>
              {listReady ? (
                <Animated.View style={[styles.list, { opacity: listOpacity }]}>
                  <SectionList<Country, PickerSection>
                    ref={listRef}
                    testID="phone-field-country-list"
                    sections={sections}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    stickySectionHeadersEnabled
                    getItemLayout={getItemLayout as never}
                    // Just enough rows to fill the sheet, then small batches.
                    initialNumToRender={Math.ceil(screenHeight / rowHeight) + 2}
                    maxToRenderPerBatch={10}
                    updateCellsBatchingPeriod={40}
                    windowSize={9}
                    initialScrollIndex={initialScrollIndex}
                    // Clipping makes rows blink while the list fades in on Android.
                    removeClippedSubviews={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    ListEmptyComponent={empty}
                    style={[styles.list, custom.list]}
                    contentContainerStyle={[
                      {
                        paddingEnd: showAlphabetIndex && !isSearching ? 20 : 0,
                        paddingBottom: spacing.lg,
                      },
                      custom.listContent,
                    ]}
                    accessibilityLabel={headerTitle}
                  />
                </Animated.View>
              ) : null}
              {listReady &&
              showAlphabetIndex &&
              !isSearching &&
              letters.length > 1 ? (
                <AlphabetIndex
                  letters={letters}
                  onJump={(index) => scrollToSection(index)}
                  color={colors.primary}
                  messages={messages}
                  style={custom.alphabetIndex}
                  letterStyle={custom.alphabetLetter}
                />
              ) : null}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

interface AlphabetIndexProps {
  letters: { letter: string; index: number }[];
  onJump: (sectionIndex: number) => void;
  color: string;
  messages: Messages;
  style?: StyleProp<ViewStyle>;
  letterStyle?: StyleProp<TextStyle>;
}

/** Vertical A–Z strip. Tap or drag over it to jump to a section. */
function AlphabetIndex({
  letters,
  onJump,
  color,
  messages,
  style,
  letterStyle,
}: AlphabetIndexProps): ReactElement {
  const viewRef = useRef<ViewRef>(null);
  const frameRef = useRef({ top: 0, height: 0 });
  const lastRef = useRef(-1);
  const lettersRef = useRef(letters);
  lettersRef.current = letters;

  // `locationY` is relative to the touched letter: use page coordinates.
  const jumpAt = useCallback(
    (pageY: number) => {
      const list = lettersRef.current;
      const { top, height } = frameRef.current;
      if (!height || list.length === 0) return;
      const ratio = (pageY - top) / height;
      const i = Math.max(
        0,
        Math.min(list.length - 1, Math.floor(ratio * list.length))
      );
      if (i === lastRef.current) return;
      lastRef.current = i;
      onJump(list[i]!.index);
    },
    [onJump]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (e) => {
          lastRef.current = -1;
          jumpAt(e.nativeEvent.pageY);
        },
        onPanResponderMove: (e) => jumpAt(e.nativeEvent.pageY),
      }),
    [jumpAt]
  );

  return (
    <View
      ref={viewRef}
      testID="phone-field-alphabet-index"
      style={[styles.alphabet, style]}
      onLayout={() => {
        viewRef.current?.measure(
          (
            _x: number,
            _y: number,
            _w: number,
            height: number,
            _pageX: number,
            pageY: number
          ) => {
            frameRef.current = { top: pageY, height };
          }
        );
      }}
      {...responder.panHandlers}
    >
      {letters.map(({ letter, index }) => (
        <Text
          key={letter}
          testID={`alphabet-letter-${letter}`}
          // Screen readers activate letters directly.
          onPress={() => onJump(index)}
          accessibilityRole="button"
          accessibilityLabel={interpolate(messages.alphabetIndexLabel, {
            letter,
          })}
          allowFontScaling={false}
          style={[styles.alphabetLetter, { color }, letterStyle]}
        >
          {letter}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  rootCenter: { justifyContent: 'center' },
  kav: { width: '100%', justifyContent: 'flex-end' },
  kavCenter: { width: '100%', alignItems: 'center' },
  container: { overflow: 'hidden', width: '100%' },
  handleArea: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { flex: 1, fontWeight: '700' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { fontSize: 14, fontWeight: '700' },
  listArea: { flex: 1 },
  list: { flex: 1 },
  sectionHeader: { justifyContent: 'center' },
  sectionHeaderText: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  empty: { alignItems: 'center' },
  emptyText: { fontSize: 15, textAlign: 'center' },
  alphabet: {
    position: 'absolute',
    end: 2,
    top: 8,
    bottom: 8,
    width: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  alphabetLetter: { fontSize: 11, fontWeight: '700', paddingVertical: 1 },
});
