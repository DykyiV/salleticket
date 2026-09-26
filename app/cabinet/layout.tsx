import { getCurrentUser } from "@/lib/auth/session";
import CabinetFrame from "@/components/cabinet/CabinetFrame";
import { can } from "@/lib/auth/permissions";
import { NAV_PERMISSIONS } from "@/lib/nav";

export const dynamic = "force-dynamic";

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const granted = await Promise.all(
    NAV_PERMISSIONS.map(async (p) => ((await can(user, p)) ? p : null))
  );

  return (
    <CabinetFrame
      user={{
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        permissions: granted.filter((p): p is NonNullable<typeof p> => p !== null),
      }}
    >
      {children}
    </CabinetFrame>
  );
}
