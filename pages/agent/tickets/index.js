import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE_SIZE = 30;

export default function AgentTicketsPage() {
  const [items, setItems] = useState([]);
  const [permission, setPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/agent/tickets?page=1", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load tickets");
        if (!active) return;
        setItems(data.items || []);
        setPermission(data.permission || null);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load tickets");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: 0 }}>Agent Tickets</h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        {permission?.canViewAllTickets
          ? "Showing all tickets"
          : "Showing only your bookings"}{" "}
        · {PAGE_SIZE} per page
      </p>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error ? (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "#fff",
              border: "1px solid #ddd",
            }}
          >
            <thead style={{ background: "#f6f6f6" }}>
              <tr>
                <Th>User</Th>
                <Th>Route</Th>
                <Th>Price</Th>
                <Th>Status</Th>
                <Th>Created At</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={5}>No tickets</Td>
                </tr>
              ) : (
                items.map((ticket) => (
                  <tr key={ticket.id}>
                    <Td>
                      <Link href={`/agent/tickets/${ticket.id}`}>{ticket.userEmail}</Link>
                    </Td>
                    <Td>{`${ticket.fromCity} → ${ticket.toCity}`}</Td>
                    <Td>€{Number(ticket.price).toFixed(2)}</Td>
                    <Td>{ticket.status}</Td>
                    <Td>{new Date(ticket.createdAt).toLocaleString()}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderBottom: "1px solid #ddd",
        fontSize: 13,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid #eee",
        fontSize: 14,
      }}
    >
      {children}
    </td>
  );
}
