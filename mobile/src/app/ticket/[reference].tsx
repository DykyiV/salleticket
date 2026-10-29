import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import TicketCard from "@/components/TicketCard";
import { Banner, Button, Loading, StateView } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadTicket, saveTicket } from "@/lib/cache";
import { cityLabel } from "@/lib/cities";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import type { OrderTickets } from "@/lib/types";
import { useRemote } from "@/lib/useRemote";

/** One order: a QR e-ticket per passenger. Saved for offline boarding. */
export default function TicketScreen() {
  const { reference: raw } = useLocalSearchParams<{ reference: string }>();
  const reference = String(raw ?? "");
  const { t } = useI18n();
  const { status, user } = useAuth();
  if (status === "loading") return <Loading />;
  if (status !== "signedIn" || !user || !reference) {
    return <StateView icon="ticket" title={t.list.signInTitle} text={t.list.signInHint} />;
  }
  return <Order key={`${user.id}:${reference}`} reference={reference} />;
}

function Order({ reference }: { reference: string }) {
  const { t, lang } = useI18n();
  const fetchOrder = useCallback(() => api<OrderTickets>(`/api/tickets/${encodeURIComponent(reference)}`), [reference]);
  const cache = useMemo(() => ({ load: () => loadTicket(reference), save: (d: OrderTickets) => saveTicket(reference, d) }), [reference]);
  const { data, offline, errorStatus, loading, refreshing, refresh } = useRemote(fetchOrder, cache);

  const first = data?.tickets[0]?.journeys[0];
  const title = first ? `${cityLabel(first.from, lang)} → ${cityLabel(first.to, lang)}` : t.ticket.title;

  if (!data) {
    if (loading) return <Loading />;
    return (
      <>
        <Stack.Screen options={{ title: t.ticket.title }} />
        <StateView icon="ticket" title={errorStatus === 404 ? t.ticket.notFound : offline ? t.auth.offline : t.list.error}>
          {errorStatus !== 404 ? <Button title={t.common.retry} onPress={refresh} /> : null}
        </StateView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} />}
      >
        {offline ? <Banner icon="wifiOff" text={t.ticket.offline} /> : null}
        {data.tickets.map((ticket) => (
          <TicketCard key={ticket.reference} ticket={ticket} />
        ))}
        <View style={styles.note}>
          <Text style={styles.noteText}>{t.ticket.arrive}</Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  note: { backgroundColor: colors.brandSoft, borderRadius: 12, padding: 14 },
  noteText: { fontSize: 14, lineHeight: 20, color: colors.brandDark },
});
