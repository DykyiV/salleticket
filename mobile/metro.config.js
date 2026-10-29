// Metro config: the app reuses a few dependency-free modules from the site
// (../lib — e.g. city names), so Metro must watch that folder too.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../lib")];

module.exports = config;
