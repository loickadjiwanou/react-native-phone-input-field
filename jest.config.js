/** @type {import('jest').Config} */
module.exports = {
  preset: '@react-native/jest-preset',
  roots: ['<rootDir>/__tests__'],
  watchman: false,
  // Cold, instrumented runs (CI coverage) can exceed the 5 s default.
  testTimeout: 20000,
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/__tests__/setup.ts',
    '<rootDir>/__tests__/helpers/',
  ],
  modulePathIgnorePatterns: ['<rootDir>/example/', '<rootDir>/lib/'],
  moduleNameMapper: {
    '^react-native-phone-input-field$': '<rootDir>/src/index',
    '^react-native-phone-input-field/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@testing-library)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/index.ts',
    '!src/core/api.ts',
    '!src/exports.ts',
    '!src/i18n/countryNames.*.ts',
  ],
  coverageThreshold: {
    './src/core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};
