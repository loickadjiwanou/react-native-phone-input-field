import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

import {
  PhoneField,
  type PhoneFieldController,
  type PhoneFieldProps,
  type PhoneFieldRef,
} from 'react-native-phone-input-field';

/** Renders a PhoneField and exposes its live controller (via renderLeft). */
export async function renderField(props: PhoneFieldProps = {}) {
  const ref = createRef<PhoneFieldRef>();
  const box: { current: PhoneFieldController | null } = { current: null };
  const utils = await render(
    <PhoneField
      ref={ref}
      defaultCountry="BJ"
      // Opt-in visual signals, so tests can assert on them.
      showErrorMessage
      showStatusIcon
      showValidMessage
      {...props}
      renderLeft={(field) => {
        box.current = field;
        return props.renderLeft?.(field) ?? null;
      }}
    />
  );
  const input = () => screen.getByTestId('phone-field-input');
  return {
    ...utils,
    ref,
    field: () => box.current!,
    input,
    type: async (text: string) => fireEvent.changeText(input(), text),
    focus: async () => fireEvent(input(), 'focus', { nativeEvent: {} }),
    blur: async () => fireEvent(input(), 'blur', { nativeEvent: {} }),
    act,
  };
}
