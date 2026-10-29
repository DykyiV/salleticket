import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Banner, Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { colors, radius } from "@/lib/theme";

/** E-mail + password, the same account as on the website. */
export default function SignInScreen() {
  const { t } = useI18n();
  const ta = t.auth;
  const router = useRouter();
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<"signIn" | "register">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const mail = email.trim();
    if (!mail || !password) return setError(ta.fill);
    if (mode === "register" && password.length < 8) return setError(ta.shortPassword);
    setBusy(true);
    setError(null);
    try {
      if (mode === "signIn") await signIn(mail, password);
      else await register(mail, password);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      setError(
        status === 0
          ? ta.offline
          : status === 429
            ? ta.tooMany
            : status === 401
              ? ta.invalid
              : status === 409
                ? ta.taken
                : status === 400 && mode === "register"
                  ? ta.shortPassword
                  : ta.generic
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: mode === "signIn" ? ta.signInTitle : ta.registerTitle }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Banner icon="wifiOff" text={error} /> : null}

        <View style={styles.field}>
          <Text style={styles.label}>{ta.email}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            placeholder="name@example.com"
            placeholderTextColor={colors.soft}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{ta.password}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            textContentType={mode === "signIn" ? "password" : "newPassword"}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {mode === "register" ? <Text style={styles.hint}>{ta.passwordHint}</Text> : null}
        </View>

        <Button title={mode === "signIn" ? ta.submitSignIn : ta.submitRegister} onPress={submit} busy={busy} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === "signIn" ? "register" : "signIn");
            setError(null);
          }}
          style={styles.switch}
        >
          <Text style={styles.switchText}>{mode === "signIn" ? ta.toRegister : ta.toSignIn}</Text>
        </Pressable>
        {mode === "signIn" ? <Text style={styles.guest}>{ta.guestHint}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: {
    minHeight: 48,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  hint: { fontSize: 12, color: colors.soft },
  switch: { alignItems: "center", paddingVertical: 6 },
  switchText: { fontSize: 15, color: colors.brand, fontWeight: "600" },
  guest: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: "center" },
});
