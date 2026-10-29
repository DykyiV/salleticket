import { Tabs } from "expo-router";
import Icon from "@/components/Icon";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.soft,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t.list.title,
          tabBarLabel: t.tabs.tickets,
          tabBarIcon: ({ color, size }) => <Icon name="ticket" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.profile.title,
          tabBarLabel: t.tabs.profile,
          tabBarIcon: ({ color, size }) => <Icon name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
