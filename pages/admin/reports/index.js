import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function money(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState(() =>
    toDateInputValue(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))
  );
  const [dateTo, setDateTo] = useState(() => toDateInputValue(new Date()));
  const [agentId, setAgentId] = useState("");
  const [agents, setAgents] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadAgents = async () => {
      try {
        const res = await fetch("/api/admin/agents", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load agents");
        if (active) setAgents(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (active) setAgents([]);
      }
    };
    void loadAgents();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadReport = async () => {
      setLoading(true);
      setError("");
      try {
        const q = new URLSearchParams();
        if (dateFrom) q.set("dateFrom", `${dateFrom}T00:00:00.000Z`);
        if (dateTo) q.set("dateTo", `${dateTo}T23:59:59.999Z`);
        const res = await fetch(`/api/reports/agents?${q.toString()}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load report");
        if (active) setRows(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (active) {
          setRows([]);
          setError(err instanceof Error ? err.message : "Failed to load report");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReport();
    return () => {
      active = false;
    };
  }, [dateFrom, dateTo]);

  const agentNameById = useMemo(() => {
    const m = new Map();
    for (const a of agents) {
      const label = a.email || a.id;
      m.set(a.id, label);
    }
    return m;
  }, [agents]);

  const filteredRows = useMemo(() => {
    if (!agentId) return rows;
    return rows.filter((r) => r.agentId === agentId);
  }, [rows, agentId]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalTickets += Number(row.totalTickets || 0);
        acc.totalRevenue += Number(row.totalRevenue || 0);
        acc.totalCommission += Number(row.totalCommission || 0);
        return acc;
      },
      { totalTickets: 0, totalRevenue: 0, totalCommission: 0 }
    );
  }, [filteredRows]);

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>Admin Reports</h1>
      <p style={{ color: "#4b5563", marginTop: 8 }}>
        Agent sales performance by date range.
      </p>

      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/agents">Agents</Link>
        <Link href="/admin/tickets">Tickets</Link>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          maxWidth: 760,
        }}
      >
        <FilterField label="Date from">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />
        </FilterField>
        <FilterField label="Date to">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </FilterField>
        <FilterField label="Agent">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={inputStyle}>
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email || a.id}
              </option>
            ))}
          </select>
        </FilterField>
      </div>

      {loading ? <p style={{ marginTop: 16 }}>Loading...</p> : null}
      {error ? <p style={{ marginTop: 16, color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error ? (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #e5e7eb",
              background: "#fff",
            }}
          >
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <Th>Agent name</Th>
                <Th>Tickets sold</Th>
                <Th>Revenue</Th>
                <Th>Commission</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <Td colSpan={4}>No data for selected filters.</Td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.agentId}>
                    <Td>{agentNameById.get(row.agentId) || row.agentId}</Td>
                    <Td>{row.totalTickets}</Td>
                    <Td>{money(row.totalRevenue)}</Td>
                    <Td>{money(row.totalCommission)}</Td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot style={{ background: "#f3f4f6" }}>
              <tr>
                <Th>Total</Th>
                <Th>{totals.totalTickets}</Th>
                <Th>{money(totals.totalRevenue)}</Th>
                <Th>{money(totals.totalCommission)}</Th>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

function Th({ children }) {
  return (
    <th
      style={{
        textAlign: "left",
        fontSize: 13,
        padding: "10px 12px",
        borderBottom: "1px solid #e5e7eb",
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
        fontSize: 14,
        padding: "10px 12px",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      {children}
    </td>
  );
}

const inputStyle = {
  height: 36,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  padding: "0 10px",
  fontSize: 14,
  background: "#fff",
};

