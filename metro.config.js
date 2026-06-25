// Metro config. ב-web מחליפים את react-native-maps (רכיב נייטיב בלבד) במודול ריק,
// כדי שה-bundle של הדפדפן לא ייכשל. בפועל ב-web משתמשים ב-app/index.web.tsx.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
