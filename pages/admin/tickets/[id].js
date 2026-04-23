import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AdminTicketDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/tickets/${id}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load ticket");
        }
        if (active) setTicket(data.ticket);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load ticket");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/tickets">← Back to tickets</Link>
      </div>
      <h1 style={{ marginBottom: 16 }}>Ticket details</h1>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error && ticket ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 16,
            maxWidth: 720,
          }}
        >
          <Row label="ID" value={ticket.id} mono />
          <Row label="User" value={ticket.user} />
          <Row label="Route" value={`${ticket.fromCity} → ${ticket.toCity}`} />
          <Row label="Price" value={`€${Number(ticket.price).toFixed(2)}`} />
          <Row label="Status" value={ticket.status} />
          <Row label="Created At" value={new Date(ticket.createdAt).toLocaleString()} />
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <strong>{label}</strong>
      <span style={mono ? { fontFamily: "monospace" } : undefined}>{value}</span>
    </div>
  );
}
