"use client";

import { useEffect, useState } from "react";
import SeatMap from "@/components/ticket/SeatMap";
import type { BusLayout } from "@/lib/seats";
import { btnGhost, btnPrimary } from "@/components/admin/Field";

export default function SeatPickerModal({
  tripId,
  exceptTicketId,
  initialSeat,
  title,
  onClose,
  onSave,
}: {
  tripId: string;
  exceptTicketId?: string;
  initialSeat: number | null;
  title: string;
  onClose: () => void;
  onSave: (seatNumber: number | null, hasAssignedSeats: boolean) => Promise<void>;
}) {
  const [layout, setLayout] = useState<BusLayout | null>(null);
  const [seat, setSeat] = useState<number | null>(initialSeat);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const qs = exceptTicketId
      ? `?exceptTicketId=${encodeURIComponent(exceptTicketId)}`
      : "";
    fetch(`/api/trips/${tripId}/seats${qs}`)
      .then((r) => r.json())
      .then((data) => setLayout(data.layout ?? null))
      .catch(() => setError("Не вдалося завантажити схему місць"));
  }, [tripId, exceptTicketId]);

  const save = async () => {
    if (!layout) return;
    if (layout.hasAssignedSeats && seat == null) {
      setError("Оберіть місце");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(seat, layout.hasAssignedSeats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" className={btnGhost} onClick={onClose}>
            Закрити
          </button>
        </div>
        <div className="mt-4">
          {layout ? (
            <SeatMap layout={layout} selectedSeatNumber={seat} onSelect={setSeat} />
          ) : (
            <p className="text-sm text-slate-500">Завантаження схеми…</p>
          )}
        </div>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy || !layout}>
            {busy ? "Збереження…" : "Зберегти місце"}
          </button>
        </div>
      </div>
    </div>
  );
}
