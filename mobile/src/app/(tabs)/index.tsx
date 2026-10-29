import { useRouter } from "expo-router";
import { Linking, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import OrderCard from "@/components/OrderCard";
import { Banner, Button, Loading, StateView } from "@/components/ui";
import { API_URL, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadOrders, saveOrders } from "@/lib/cache";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";
import type { MyOrder, MyOrders } from "@/lib/types";
import { useRemote } from "@/lib/useRemote";

const ORDERS_CACHE = { load: loadOrders, save: saveOrders };
const fetchOrders = () => api<MyOrders>("/api/me/tickets");

/** «Мої квитки»: refreshed on every visit, on return to the app and on pull. */
export default function MyTicketsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { status, user } = useAuth();

  if (status === "loading") return <Loading />;
  if (status !== "signedIn" || !user) {
    return (
      <StateView icon="ticket" title={t.list.signInTitle} text={t.list.signInHint}>
        <Button title={t.common.signIn} onPress={() => router.push("/sign-in")} />
      </StateView>
    );
  }
  // Keyed by the account, so a new sign-in never shows the previous list.
  return <Orders key={user.id} />;
}

function Orders() {
  const { t } = useI18n();
  const router = useRouter();
  const { data, offline, errorStatus, loading, refreshing, refresh } = useRemote(fetchOrders, ORDERS_CACHE);

  if (!data) {
    if (loading) return <Loading />;
    return (
      <StateView icon={offline ? "wifiOff" : "ticket"} title={offline ? t.auth.offline : t.list.error}>
        <Button title={t.common.retry} onPress={refresh} />
      </StateView>
    );
  }

  const sections = [
    { key: "upcoming", title: t.list.upcoming, data: data.upcoming, muted: false },
    { key: "past", title: t.list.past, data: data.past, muted: true },
  ].filter((s) => s.data.length > 0);

  const open = (order: MyOrder) => router.push(`/ticket/${encodeURIComponent(order.tickets[0].reference)}`);

  return (
    <SectionList
      style={styles.list}
      contentContainerStyle={sections.length ? styles.content : styles.emptyContent}
      sections={sections}
      keyExtractor={(order) => order.key}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} colors={[colors.brand]} />}
      ListHeaderComponent={
        offline ? (
          <View style={styles.banner}>
            <Banner icon="wifiOff" text={t.list.offline} />
          </View>
        ) : errorStatus && errorStatus !== 0 ? (
          <View style={styles.banner}>
            <Banner icon="wifiOff" text={t.list.error} />
          </View>
        ) : undefined
      }
      renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
      renderItem={({ item, section }) => (
        <View style={styles.item}>
          <OrderCard order={item} muted={section.muted} onPress={() => open(item)} />
        </View>
      )}
      ListEmptyComponent={
        <StateView icon="ticket" title={t.list.empty} text={t.list.emptyHint}>
          <Button title={t.list.findTrip} icon="search" variant="secondary" onPress={() => Linking.openURL(`${API_URL}/#search`)} />
        </StateView>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 32 },
  emptyContent: { flexGrow: 1 },
  banner: { marginBottom: 8 },
  section: { fontSize: 15, fontWeight: "700", color: colors.navy, marginTop: 12, marginBottom: 10 },
  item: { marginBottom: 12 },
});
