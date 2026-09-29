"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Driver's boarding control: scan the ticket QR → open the check page. */
export default function TicketScanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let instance: import("html5-qrcode").Html5Qrcode | null = null;

    const start = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        instance = new Html5Qrcode("qr-reader");
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            const match = /AB-\d{5}/.exec(decoded) ?? /AB-[A-Z0-9]+/i.exec(decoded);
            if (!match) return;
            const reference = match[0].toUpperCase();
            setLast(reference);
            void instance?.stop().catch(() => {});
            router.push(`/check/${reference}`);
          },
          () => {}
        );
      } catch {
        setError("Немає доступу до камери — введіть номер вручну.");
      }
    };
    void start();

    return () => {
      cancelled = true;
      void scannerRef.current?.stop().catch(() => {});
    };
  }, [router]);

  return (
    <div className="space-y-4">
      <div
        id="qr-reader"
        className="overflow-hidden rounded-2xl bg-black ring-1 ring-slate-200"
        style={{ minHeight: 280 }}
      />
      {last ? (
        <p className="text-sm text-emerald-700">Зчитано: {last} — відкриваю…</p>
      ) : null}
      {error ? <p className="text-sm text-amber-700">{error}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const ref = manual.trim().toUpperCase();
          if (ref) router.push(`/check/${ref}`);
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="AB-12345"
          className="h-11 flex-1 rounded-xl border border-slate-300 px-3 font-mono text-sm uppercase tracking-widest"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-4 text-sm font-medium text-white"
        >
          Перевірити
        </button>
      </form>
    </div>
  );
}
