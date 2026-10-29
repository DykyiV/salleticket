import type { ExpoConfig } from "expo/config";

/**
 * Grandes Tour mobile app. Ships as an update of the existing App Store
 * listing (id 6447769469), so the bundle id stays the one users already have.
 *
 * EXPO_PUBLIC_API_URL — the new ticket site the app talks to (no trailing
 * slash), e.g. https://grandes-tour.com.ua once the new site is live there.
 */
const config: ExpoConfig = {
  name: "Grandes Tour",
  slug: "grandes-tour",
  scheme: "grandestour",
  version: "9.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "com.devmetro.grandestour",
    // App Store Connect already has builds up to 329 (8.60).
    buildNumber: "330",
    supportsTablet: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: "com.dev_metro.grandestour",
    adaptiveIcon: {
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundColor: "#FFFFFF",
    },
  },
  web: {
    favicon: "./assets/favicon.png",
    output: "single",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 220,
        backgroundColor: "#FFFFFF",
      },
    ],
    "expo-secure-store",
    "expo-localization",
    "expo-font",
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  },
};

export default config;
