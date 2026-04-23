import Link from "next/link";
import { useEffect, useState } from "react";

export default function AdminUsersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/users", {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load users");
        }
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
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
      <h1 style={{ marginTop: 0 }}>Admin Users</h1>
      <p style={{ color: "#4b5563", marginTop: 8 }}>
        All registered users in the system.
      </p>
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <Link href="/admin/agents">Go to agent permissions →</Link>
      </div>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error ? (
        <div style={{ overflowX: "auto" }}>
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
                <Th>ID</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Created At</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <Td colSpan={4}>No users found.</Td>
                </tr>
              ) : (
                items.map((user) => (
                  <tr key={user.id}>
                    <Td mono>{user.id}</Td>
                    <Td>{user.email}</Td>
                    <Td>{user.role}</Td>
                    <Td>{new Date(user.createdAt).toLocaleString()}</Td>
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
        fontSize: 13,
        padding: "10px 12px",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, colSpan, mono }) {
  return (
    <td
      colSpan={colSpan}
      style={{
        fontSize: 14,
        padding: "10px 12px",
        borderBottom: "1px solid #f3f4f6",
        fontFamily: mono ? "monospace" : undefined,
      }}
    >
      {children}
    </td>
  );
}
