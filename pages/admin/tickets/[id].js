import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AdminTicketDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    adminComment: "",
  });
  const [saveStatus, setSaveStatus] = useState("");
  const [saving, setSaving] = useState(false);

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
        if (active) {
          setTicket(data.ticket);
          setForm({
            firstName: data.ticket.firstName || "",
            lastName: data.ticket.lastName || "",
            phone: data.ticket.phone || "",
            adminComment: data.ticket.adminComment || "",
          });
        }
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

  const save = async (e) => {
    e.preventDefault();
    if (!id) return;
    setSaveStatus("");
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save changes");
      }
      setTicket(data.ticket);
      setForm({
        firstName: data.ticket.firstName || "",
        lastName: data.ticket.lastName || "",
        phone: data.ticket.phone || "",
        adminComment: data.ticket.adminComment || "",
      });
      setSaveStatus("Saved");
    } catch (err) {
      setSaveStatus(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/tickets">← Back to tickets</Link>
      </div>
      <h1 style={{ marginBottom: 16 }}>Ticket details</h1>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error && ticket ? (
        <div style={{ display: "grid", gap: 16, maxWidth: 820 }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Row label="ID" value={ticket.id} mono />
            <Row label="User" value={`${ticket.userName} (${ticket.userEmail})`} />
            <Row label="Route" value={`${ticket.fromCity} → ${ticket.toCity}`} />
            <Row label="Price" value={`€${Number(ticket.price).toFixed(2)}`} />
            <Row label="Status" value={ticket.status} />
            <Row
              label="Created At"
              value={new Date(ticket.createdAt).toLocaleString()}
            />
          </div>

          <form
            onSubmit={save}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 16,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Edit passenger</h2>

            <Field
              label="First name"
              value={form.firstName}
              onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
              required
            />
            <Field
              label="Last name"
              value={form.lastName}
              onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
              required
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
              required
            />
            <TextAreaField
              label="Admin comment"
              value={form.adminComment}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, adminComment: value }))
              }
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {saveStatus ? (
                <span style={{ color: saveStatus === "Saved" ? "#065f46" : "#b91c1c" }}>
                  {saveStatus}
                </span>
              ) : null}
            </div>
          </form>
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

function Field({ label, value, onChange, required }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          height: 36,
          borderRadius: 6,
          border: "1px solid #d1d5db",
          padding: "0 10px",
          fontSize: 14,
        }}
      />
    </label>
  );
}

function TextAreaField({ label, value, onChange }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={{
          borderRadius: 6,
          border: "1px solid #d1d5db",
          padding: 10,
          fontSize: 14,
          resize: "vertical",
        }}
      />
    </label>
  );
}
