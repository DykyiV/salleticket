import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import { Button, Card } from "@/components/ui";
import { API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LANGS, LANG_LABEL, fmt, useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

export default function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const { status, user, signOut } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const version = Constants.expoConfig?.version ?? "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Icon name="user" size={22} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            {status === "signedIn" && user ? (
              <>
                <Text style={styles.muted}>{t.profile.signedInAs}</Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user.email}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.email}>{t.profile.signedOutTitle}</Text>
                <Text style={styles.muted}>{t.profile.signedOutHint}</Text>
              </>
            )}
          </View>
        </View>
        {status === "signedIn" ? (
          <View style={{ gap: 6 }}>
            <Button
              title={t.common.signOut}
              icon="logout"
              variant="secondary"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                await signOut();
                setBusy(false);
              }}
            />
            <Text style={styles.hint}>{t.profile.signOutHint}</Text>
          </View>
        ) : status === "signedOut" ? (
          <Button title={t.common.signIn} onPress={() => router.push("/sign-in")} />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>{t.profile.language}</Text>
        <View style={styles.langs}>
          {LANGS.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityState={{ selected: code === lang }}
              onPress={() => setLang(code)}
              style={[styles.lang, code === lang && styles.langOn]}
            >
              <Text style={[styles.langText, code === lang && styles.langTextOn]}>{LANG_LABEL[code].name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(API_URL)} style={styles.row}>
          <Icon name="globe" size={20} color={colors.brand} />
          <Text style={[styles.email, { flex: 1, fontSize: 16 }]}>{t.common.openSite}</Text>
          <Icon name="chevronRight" size={18} color={colors.soft} />
        </Pressable>
      </Card>

      <Text style={styles.version}>{fmt(t.profile.version, { v: version })}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14 },
  card: { padding: 16, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { fontSize: 13, color: colors.muted },
  email: { fontSize: 17, fontWeight: "700", color: colors.navy },
  hint: { fontSize: 12, color: colors.soft, textAlign: "center" },
  label: { fontSize: 12, fontWeight: "700", color: colors.soft, textTransform: "uppercase", letterSpacing: 0.4 },
  langs: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  lang: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  langOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  langText: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  langTextOn: { color: colors.white },
  version: { textAlign: "center", fontSize: 12, color: colors.soft, marginTop: 4 },
});
