// The app's own lint config (the site's config at the repo root ignores mobile/).
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([globalIgnores(["dist/*", ".expo/*"]), expoConfig]);
