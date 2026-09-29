import PageHeader from "@/components/cabinet/PageHeader";
import TicketScanner from "@/components/cabinet/TicketScanner";
import { getCurrentUser } from "@/lib/auth/session";
import { hasRoleAtLeast } from "@/lib/auth/constants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CabinetScanPage() {
  const user = await getCurrentUser();
  if (!user || !hasRoleAtLeast(user.role, "DRIVER")) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Сканер квитків"
        subtitle="Контроль посадки: наведіть камеру на QR квитка або введіть номер."
      />
      <TicketScanner />
    </div>
  );
}
