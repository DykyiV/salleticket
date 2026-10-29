import { Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "@/components/Icon";
import StatePill from "@/components/StatePill";
import { cityLabel } from "@/lib/cities";
import { clock, dayNumber, money, monthShort } from "@/lib/format";
import { plural, useI18n } from "@/lib/i18n";
import { colors, radius, shadow } from "@/lib/theme";
import type { MyOrder } from "@/lib/types";

/** One order in «Мої квитки»: date badge, route, passengers, status, total. */
export default function OrderCard({ order, onPress, muted }: { order: MyOrder; onPress: () => void; muted?: boolean }) {
  const { t, lang } = useI18n();
  const head = order.tickets[0];
  const j = head?.journeys[0];
  const back = head?.journeys.find((x) => x.kind === "return");
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, muted && { opacity: 0.75 }, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.date}>
        {j?.departAt ? (
          <>
            <Text style={styles.day}>{dayNumber(j.departAt)}</Text>
            <Text style={styles.month}>{monthShort(j.departAt, lang)}</Text>
          </>
        ) : (
          <Icon name="ticket" size={22} color={colors.brand} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.route} numberOfLines={2}>
          {j ? `${cityLabel(j.from, lang)} → ${cityLabel(j.to, lang)}` : head?.reference}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[
            j?.departAt ? clock(j.departAt) : null,
            back ? (head.openReturn ? t.ticket.openReturn : `${t.ticket.return} ${back.departAt ? `${dayNumber(back.departAt)} ${monthShort(back.departAt, lang)}` : ""}`.trim()) : null,
            plural(lang, order.tickets.length, t.list.passengersN),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.foot}>
          <StatePill state={order.state} />
          {order.total > 0 ? <Text style={styles.total}>{money(order.total, lang)}</Text> : null}
        </View>
      </View>
      <Icon name="chevronRight" size={20} color={colors.soft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 14,
    ...shadow,
  },
  date: {
    width: 56,
    height: 60,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  day: { fontSize: 22, fontWeight: "800", color: colors.brandDark, lineHeight: 26 },
  month: { fontSize: 11, fontWeight: "700", color: colors.brandDark, textTransform: "uppercase" },
  body: { flex: 1, gap: 4 },
  route: { fontSize: 16, fontWeight: "700", color: colors.navy },
  meta: { fontSize: 13, color: colors.muted },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  total: { fontSize: 15, fontWeight: "700", color: colors.navy },
});
