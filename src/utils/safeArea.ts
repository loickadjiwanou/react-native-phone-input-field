import { createContext, useContext, type Context } from 'react';
import { Dimensions, Platform, StatusBar } from 'react-native';

// Metro treats `require` inside `try` as optional: bundling works without
// react-native-safe-area-context.
declare const require: (id: string) => unknown;

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type InsetsContext = Context<EdgeInsets | null>;

function loadSafeAreaContext(): InsetsContext | null {
  try {
    const mod = require('react-native-safe-area-context') as {
      SafeAreaInsetsContext?: InsetsContext;
    };
    return mod.SafeAreaInsetsContext ?? null;
  } catch {
    return null;
  }
}

const SafeAreaInsetsContext = loadSafeAreaContext();

const FallbackContext: InsetsContext = createContext<EdgeInsets | null>(null);
const InsetsContextToUse: InsetsContext =
  SafeAreaInsetsContext ?? FallbackContext;

/** Heuristic insets when react-native-safe-area-context is not available. */
export function fallbackInsets(): EdgeInsets {
  if (Platform.OS === 'ios') {
    const { width, height } = Dimensions.get('window');
    const longSide = Math.max(width, height);
    const hasNotch = !Platform.isPad && !Platform.isTV && longSide >= 812;
    return {
      top: hasNotch ? 50 : 20,
      bottom: hasNotch ? 34 : 0,
      left: 0,
      right: 0,
    };
  }
  if (Platform.OS === 'android') {
    // The picker draws behind the navigation bar: estimate its height
    // (screen − window − status bar), at least the gesture bar height.
    const statusBar = StatusBar.currentHeight ?? 24;
    const screen = Dimensions.get('screen').height;
    const window = Dimensions.get('window').height;
    const navBar = Math.max(24, Math.round(screen - window - statusBar));
    return { top: statusBar, bottom: navBar, left: 0, right: 0 };
  }
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

/**
 * Safe-area insets from react-native-safe-area-context when installed and a
 * `SafeAreaProvider` is mounted, otherwise a platform-based fallback.
 */
export function useSafeInsets(): EdgeInsets {
  const insets = useContext(InsetsContextToUse);
  return insets ?? fallbackInsets();
}
