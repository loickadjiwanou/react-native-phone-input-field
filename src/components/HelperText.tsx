import { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';

export interface HelperTextProps {
  /** Text to show; `null` hides the area with an animation. */
  message: string | null;
  color: string;
  style?: StyleProp<TextStyle>;
  fontSize: number;
  fontFamily?: TextStyle['fontFamily'];
  /** Politely announce changes (Android live region). */
  live?: boolean;
  testID?: string;
}

/**
 * Helper / error line under the field. Height is animated on the JS driver
 * (layout props cannot use the native driver); opacity and translation run
 * on the native driver, on a nested view so the two drivers never mix.
 */
export const HelperText = memo(function HelperText({
  message,
  color,
  style,
  fontSize,
  fontFamily,
  live,
  testID = 'phone-field-helper',
}: HelperTextProps) {
  // Keep the last message while hiding, so it fades out instead of vanishing.
  const [shown, setShown] = useState(message);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useRef(new Animated.Value(message ? 1 : 0)).current;
  const fade = useRef(new Animated.Value(message ? 1 : 0)).current;
  const visible = !!message;

  useEffect(() => {
    if (message) setShown(message);
    Animated.parallel([
      Animated.timing(height, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) setShown(null);
    });
  }, [message, visible, height, fade]);

  const animatedHeight = height.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });

  return (
    <Animated.View
      style={[
        styles.clip,
        { height: contentHeight ? animatedHeight : undefined },
      ]}
    >
      <Animated.View
        style={[
          styles.inner,
          {
            opacity: fade,
            transform: [
              {
                translateY: fade.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, 0],
                }),
              },
            ],
          },
        ]}
        onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
      >
        {shown ? (
          <Text
            testID={testID}
            accessibilityLiveRegion={live ? 'polite' : 'none'}
            style={[styles.text, { color, fontSize, fontFamily }, style]}
          >
            {shown}
          </Text>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  inner: { position: 'absolute', left: 0, right: 0, top: 0 },
  text: { paddingTop: 6 },
});
