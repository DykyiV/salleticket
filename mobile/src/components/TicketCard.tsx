import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import Icon, { type IconName } from "@/components/Icon";
import StatePill from "@/components/StatePill";
import { Card } from "@/components/ui";
import { cityLabel } from "@/lib/cities";
import { arrival, clock, longDate, money } from "@/lib/format";
import { fmt, useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import type { ETicket, ETicketJourney } from "@/lib/types";

/** One passenger's e-ticket: QR for the driver, journeys, seat, price. */
export default function TicketCard({ ticket }: { ticket: ETicket }) {
  const { t, lang } = useI18n();
  const tt = t.ticket;
  const live = ticket.state !== "cancelled" && ticket.state !== "refunded";
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{tt.passenger}</Text>
          <Text style={styles.name}>
            {ticket.firstName} {ticket.lastName}
          </Text>
        </View>
        <StatePill state={ticket.state} />
      </View>

      <View style={[styles.qrBox, !live && { opacity: 0.35 }]}>
        <QRCode value={ticket.checkUrl} size={196} color={colors.navy} backgroundColor={colors.white} quietZone={10} />
        <Text style={styles.ref}>{ticket.reference}</Text>
        {live ? <Text style={styles.qrHint}>{tt.qrHint}</Text> : null}
      </View>

      {ticket.journeys.map((j) => (
        <Journey key={j.kind} journey={j} openReturn={ticket.openReturn && j.kind === "return"} />
      ))}
      {ticket.openReturn && !ticket.journeys.some((j) => j.kind === "return") ? (
        <Text style={styles.section}>{tt.openReturn}</Text>
      ) : null}

      <View style={styles.priceRow}>
        <Text style={styles.label}>{ticket.toPay > 0 ? tt.toPay : tt.price}</Text>
        <Text style={[styles.price, ticket.toPay > 0 ? { color: colors.warn } : ticket.state === "paid" ? { color: colors.ok } : null]}>
          {money(ticket.toPay > 0 ? ticket.toPay : ticket.price, lang)}
          {ticket.state === "paid" ? ` · ${tt.paid}` : ""}
        </Text>
      </View>
    </Card>
  );
}

function Journey({ journey: j, openReturn }: { journey: ETicketJourney; openReturn: boolean }) {
  const { t, lang } = useI18n();
  const tt = t.ticket;
  return (
    <View style={styles.journey}>
      <Text style={styles.section}>{j.kind === "outbound" ? tt.outbound : openReturn ? tt.openReturn : tt.return}</Text>
      <Text style={styles.route}>
        {cityLabel(j.from, lang)} → {cityLabel(j.to, lang)}
      </Text>
      {j.departAt ? (
        <Text style={styles.when}>
          {longDate(j.departAt, lang)}, {clock(j.departAt)}
          {j.arriveAt ? ` → ${arrival(j.departAt, j.arriveAt, lang)}` : ""}
        </Text>
      ) : null}
      <Stop icon="pin" label={tt.boarding} address={j.boardAddress} map={j.boardMap} />
      <Stop icon="pin" label={tt.dropoff} address={j.alightAddress} map={j.alightMap} />
      <View style={styles.facts}>
        <Fact icon="seat" label={tt.seat} value={j.freeSeating || j.seat == null ? tt.noSeat : fmt(tt.seatN, { n: j.seat })} />
        <Fact icon="bus" label={tt.bus} value={j.bus ?? tt.busTbd} />
      </View>
      {j.legs.length > 1 ? (
        <View style={{ gap: 4, marginTop: 6 }}>
          <Text style={styles.label}>{tt.transfer}</Text>
          {j.legs.map((l, i) => (
            <Text key={`${l.from}-${i}`} style={styles.leg}>
              {cityLabel(l.from, lang)} → {cityLabel(l.to, lang)}
              {l.seat != null ? ` · ${fmt(tt.seatN, { n: l.seat })}` : ""}
              {l.bus ? ` · ${l.bus}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
      {j.carrier ? (
        <Text style={styles.carrier}>
          {tt.carrier}: {j.carrier}
        </Text>
      ) : null}
    </View>
  );
}

function Stop({ icon, label, address, map }: { icon: IconName; label: string; address: string | null; map: string | null }) {
  const { t } = useI18n();
  if (!address) return null;
  return (
    <View style={styles.stop}>
      <Icon name={icon} size={16} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.address}>{address}</Text>
        {map ? (
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(map)} hitSlop={8}>
            <Text style={styles.link}>{t.ticket.map}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={colors.soft} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  label: { fontSize: 12, fontWeight: "600", color: colors.soft, textTransform: "uppercase", letterSpacing: 0.4 },
  name: { fontSize: 18, fontWeight: "700", color: colors.navy, marginTop: 2 },
  qrBox: { alignItems: "center", paddingVertical: 8, gap: 8 },
  ref: { fontSize: 16, fontWeight: "700", color: colors.navy, letterSpacing: 1 },
  qrHint: { fontSize: 13, color: colors.muted, textAlign: "center" },
  journey: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12 },
  section: { fontSize: 12, fontWeight: "700", color: colors.brand, textTransform: "uppercase", letterSpacing: 0.4 },
  route: { fontSize: 17, fontWeight: "700", color: colors.navy },
  when: { fontSize: 14, color: colors.ink },
  stop: { flexDirection: "row", gap: 8, marginTop: 4 },
  address: { fontSize: 14, color: colors.ink, marginTop: 1 },
  link: { fontSize: 14, color: colors.brand, fontWeight: "600", marginTop: 2 },
  facts: { flexDirection: "row", gap: 18, marginTop: 6, flexWrap: "wrap" },
  fact: { flexDirection: "row", alignItems: "center", gap: 8 },
  value: { fontSize: 14, fontWeight: "600", color: colors.ink },
  leg: { fontSize: 14, color: colors.ink },
  carrier: { fontSize: 13, color: colors.muted, marginTop: 4 },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 12,
  },
  price: { fontSize: 17, fontWeight: "800", color: colors.navy },
});
