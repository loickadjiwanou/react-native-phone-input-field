/**
 * Metro config for the example: the library is served straight from ../src
 * (no build step), and React / React Native are always taken from the
 * example so there is a single copy of each.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const libraryRoot = path.resolve(projectRoot, '..');
const pkg = require('../package.json');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [libraryRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(libraryRoot, 'node_modules'),
];

/** Entry points of the library, mapped to their TypeScript sources. */
const librarySources = {
  [pkg.name]: 'src/index.ts',
  [`${pkg.name}/min`]: 'src/min.ts',
  [`${pkg.name}/core`]: 'src/core/index.ts',
  [`${pkg.name}/zod`]: 'src/zod.ts',
};

/** Modules that must exist only once in the bundle. */
const singletons = [
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
  'react-native-safe-area-context',
  'expo-localization',
  'libphonenumber-js',
  'zod',
];

const exampleOrigin = path.join(projectRoot, 'index.ts');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const source = librarySources[moduleName];
  if (source) {
    return { type: 'sourceFile', filePath: path.join(libraryRoot, source) };
  }
  const isSingleton = singletons.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`)
  );
  if (isSingleton) {
    // Resolve as if imported from the example itself.
    return context.resolveRequest(
      { ...context, originModulePath: exampleOrigin },
      moduleName,
      platform
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
