import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <I18nProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootStack />
      </AuthProvider>
    </I18nProvider>
  );
}

function RootStack() {
  const { t } = useI18n();
  const { status } = useAuth();

  // Keep the splash until we know whether the saved sign-in is still valid.
  useEffect(() => {
    if (status !== "loading") SplashScreen.hide();
  }, [status]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ presentation: "modal", title: t.auth.signInTitle }} />
      <Stack.Screen name="ticket/[reference]" options={{ title: t.ticket.title }} />
    </Stack>
  );
}
