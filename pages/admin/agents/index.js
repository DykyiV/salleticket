import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminAgentsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/agents", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load agents");
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load agents");
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
      <h1 style={{ margin: 0 }}>Admin Agents</h1>
      <p style={{ color: "#4b5563", marginTop: 8 }}>
        Agents and their current permissions.
      </p>

      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/tickets">Tickets</Link>
      </div>

      {loading ? <p style={{ marginTop: 16 }}>Loading...</p> : null}
      {error ? <p style={{ marginTop: 16, color: "#b91c1c" }}>{error}</p> : null}

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
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>User ID</Th>
                <Th>canEditName</Th>
                <Th>canViewAllTickets</Th>
                <Th>canViewSpecificUsers</Th>
                <Th>canMarkCashPaid</Th>
                <Th>Commission</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={8}>No agents found.</Td>
                </tr>
              ) : (
                items.map((agent) => (
                  <tr key={agent.id}>
                    <Td>
                      <Link href={`/admin/agents/${agent.id}`}>{agent.id}</Link>
                    </Td>
                    <Td>{agent.email}</Td>
                    <Td>{agent.userId}</Td>
                    <Td>{bool(agent.canEditName)}</Td>
                    <Td>{bool(agent.canViewAllTickets)}</Td>
                    <Td>{bool(agent.canViewSpecificUsers)}</Td>
                    <Td>{bool(agent.canMarkCashPaid)}</Td>
                    <Td>{`${agent.commissionType} ${agent.commissionValue}`}</Td>
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

function bool(v) {
  return v ? "true" : "false";
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
