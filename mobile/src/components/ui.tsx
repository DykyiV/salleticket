import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Icon, { type IconName } from "@/components/Icon";
import { colors, radius, shadow } from "@/lib/theme";

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  busy,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === "primary";
  const fg = primary ? colors.white : colors.brandDark;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : variant === "secondary" ? styles.buttonSecondary : styles.buttonGhost,
        (pressed || disabled) && { opacity: 0.75 },
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Centered message: empty list, sign-in prompt, error. */
export function StateView({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Icon name={icon} size={26} color={colors.brand} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      {text ? <Text style={styles.stateText}>{text}</Text> : null}
      {children ? <View style={styles.stateActions}>{children}</View> : null}
    </View>
  );
}

export function Banner({ icon, text, tone = "warn" }: { icon: IconName; text: string; tone?: "warn" | "info" }) {
  const fg = tone === "warn" ? colors.warn : colors.info;
  const bg = tone === "warn" ? colors.warnSoft : colors.infoSoft;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Icon name={icon} size={16} color={fg} />
      <Text style={[styles.bannerText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.state}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow,
  },
  button: {
    minHeight: 48,
    borderRadius: radius.button,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonSecondary: { backgroundColor: colors.brandSoft },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stateTitle: { marginTop: 16, fontSize: 18, fontWeight: "700", color: colors.navy, textAlign: "center" },
  stateText: { marginTop: 8, fontSize: 15, lineHeight: 21, color: colors.muted, textAlign: "center", maxWidth: 340 },
  stateActions: { marginTop: 20, alignSelf: "stretch", maxWidth: 340, width: "100%", gap: 10, marginHorizontal: "auto" },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  bannerText: { flex: 1, fontSize: 14, fontWeight: "500" },
});
