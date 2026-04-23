import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function AgentTicketDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [ticket, setTicket] = useState(null);
  const [permission, setPermission] = useState(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setStatus("");
      setError("");
      try {
        const res = await fetch(`/api/agent/tickets/${id}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load ticket");
        if (!active) return;
        setTicket(data.ticket);
        setPermission(data.permission);
        setForm({
          firstName: data.ticket.firstName || "",
          lastName: data.ticket.lastName || "",
          phone: data.ticket.phone || "",
        });
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

  const canEditName = Boolean(permission?.canEditName);
  const canMarkCashPaid = Boolean(permission?.canMarkCashPaid);

  const save = async (e) => {
    e.preventDefault();
    if (!id) return;
    setStatus("");
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");
      setTicket(data.ticket);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const markCashPaid = async () => {
    if (!id) return;
    setStatus("");
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ markCashPaid: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to mark cash paid");
      setTicket(data.ticket);
      setStatus("Marked as paid (cash)");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to mark cash paid");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/agent/tickets">← Back to agent tickets</Link>
      </div>
      <h1 style={{ marginBottom: 8 }}>Agent ticket details</h1>

      {loading ? <p>Loading...</p> : null}
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error && ticket ? (
        <div style={{ display: "grid", gap: 16, maxWidth: 820 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 }}>
            <Row label="ID" value={ticket.id} />
            <Row label="User" value={`${ticket.userName} (${ticket.userEmail})`} />
            <Row label="Route" value={`${ticket.fromCity} → ${ticket.toCity}`} />
            <Row label="Price" value={`€${Number(ticket.price).toFixed(2)}`} />
            <Row label="Status" value={ticket.status} />
            <Row label="Created At" value={new Date(ticket.createdAt).toLocaleString()} />
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
            <h2 style={{ margin: 0, fontSize: 18 }}>Passenger data</h2>
            {!canEditName ? (
              <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
                Editing disabled by permission (canEditName = false).
              </p>
            ) : null}

            <Field
              label="First name"
              value={form.firstName}
              disabled={!canEditName}
              onChange={(value) => setForm((prev) => ({ ...prev, firstName: value }))}
            />
            <Field
              label="Last name"
              value={form.lastName}
              disabled={!canEditName}
              onChange={(value) => setForm((prev) => ({ ...prev, lastName: value }))}
            />
            <Field
              label="Phone"
              value={form.phone}
              disabled={!canEditName}
              onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))}
            />

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="submit"
                disabled={saving || !canEditName}
                style={buttonStyle(saving || !canEditName)}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              {canMarkCashPaid ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={markCashPaid}
                  style={buttonStyle(saving, "#065f46")}
                >
                  Mark as paid (cash)
                </button>
              ) : null}
              {status ? (
                <span style={{ color: status.includes("Failed") ? "#b91c1c" : "#065f46" }}>
                  {status}
                </span>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }) {
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
      <span>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, disabled }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          borderRadius: 6,
          border: "1px solid #d1d5db",
          padding: "0 10px",
          fontSize: 14,
          background: disabled ? "#f3f4f6" : "#fff",
          color: disabled ? "#6b7280" : "#111827",
        }}
      />
    </label>
  );
}

function buttonStyle(disabled, color = "#111827") {
  return {
    padding: "8px 14px",
    borderRadius: 6,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}
