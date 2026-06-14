// Metro config — extend Expo's default so the real 3D brain mesh bundles.
// expo-three / GLTFLoader load assets/brain/fsaverage5.glb via require(), and
// Metro won't bundle .glb/.gltf/.bin unless we add them to assetExts.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb", "gltf", "bin");

module.exports = config;
