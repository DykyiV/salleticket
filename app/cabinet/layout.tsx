import { getCurrentUser } from "@/lib/auth/session";
import CabinetFrame from "@/components/cabinet/CabinetFrame";

export const dynamic = "force-dynamic";

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <CabinetFrame
      user={{
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </CabinetFrame>
  );
}
