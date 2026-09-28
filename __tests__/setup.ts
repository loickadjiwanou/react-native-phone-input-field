import { AccessibilityInfo } from 'react-native';

// Keep announcements observable and silent.
jest
  .spyOn(AccessibilityInfo, 'announceForAccessibility')
  .mockImplementation(() => {});
