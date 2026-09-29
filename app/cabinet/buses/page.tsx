import PageHeader from "@/components/cabinet/PageHeader";
import BusesAdmin, { type BusRow } from "@/components/admin/BusesAdmin";
import { prisma } from "@/lib/db";
import { buildLayout, parseCoachLayout } from "@/lib/seats";

export const dynamic = "force-dynamic";

export default async function CabinetBusesPage() {
  const buses = await prisma.bus.findMany({ orderBy: { plate: "asc" } });
  const rows: BusRow[] = buses.map((bus) => {
    const layout = parseCoachLayout(bus.layout);
    return {
      id: bus.id,
      plate: bus.plate,
      model: bus.model,
      decks: bus.decks,
      isActive: bus.isActive,
      seatCount: buildLayout(layout).seatCount,
      layout,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Автобуси"
        subtitle="Автопарк і схеми салонів: палуби, WC, двері, спальні місця, множники ціни."
      />
      <BusesAdmin initialBuses={rows} />
    </div>
  );
}
