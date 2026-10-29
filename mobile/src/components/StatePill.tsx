import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import type { ETicketState } from "@/lib/types";

const TONE: Record<ETicketState, { fg: string; bg: string }> = {
  due: { fg: colors.warn, bg: colors.warnSoft },
  pending: { fg: colors.info, bg: colors.infoSoft },
  paid: { fg: colors.ok, bg: colors.okSoft },
  cancelled: { fg: colors.danger, bg: colors.dangerSoft },
  refunded: { fg: colors.muted, bg: "#F1F5F9" },
};

export default function StatePill({ state }: { state: ETicketState }) {
  const { t } = useI18n();
  const tone = TONE[state];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{t.ticket.status[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: "700" },
});
