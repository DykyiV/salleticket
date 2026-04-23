import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const PAGE_SIZE = 30;

export default function AdminTicketsPage() {
  const router = useRouter();
  const rawPage = router.query.page;
  const page = Math.max(
    1,
    Number.parseInt(Array.isArray(rawPage) ? rawPage[0] : rawPage || "1", 10) || 1
  );

  const [items, setItems] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/tickets?page=${page}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load tickets");
        }
        if (!active) return;
        setItems(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load tickets");
          setItems([]);
          setTotalPages(1);
          setTotalItems(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [page]);

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const pageHref = (targetPage) => ({
    pathname: "/admin/tickets",
    query: { page: String(targetPage) },
  });

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: 0 }}>Admin Tickets</h1>
      <p style={{ color: "#555", marginTop: 8 }}>
        Showing all tickets · sorted by createdAt DESC · {PAGE_SIZE} per page
      </p>

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
            {loading ? (
              <tr>
                <Td colSpan={5}>Loading tickets...</Td>
              </tr>
            ) : null}
            {!loading && error ? (
              <tr>
                <Td colSpan={5} style={{ color: "#b91c1c" }}>
                  {error}
                </Td>
              </tr>
            ) : null}
            {!loading && !error && items.length === 0 ? (
              <tr>
                <Td colSpan={5}>No tickets</Td>
              </tr>
            ) : (
              !loading &&
              !error &&
              items.map((ticket) => (
                <tr key={ticket.id}>
                  <Td>
                    <Link href={`/admin/tickets/${ticket.id}`}>{ticket.userEmail}</Link>
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

      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
        {hasPrev ? <Link href={pageHref(page - 1)}>← Prev</Link> : <span>← Prev</span>}
        <span>
          Page {page} / {Math.max(totalPages, 1)} · Total {totalItems}
        </span>
        {hasNext ? <Link href={pageHref(page + 1)}>Next →</Link> : <span>Next →</span>}
      </div>
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
