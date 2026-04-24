import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const EMPTY_FORM = {
  canEditName: false,
  canViewAllTickets: false,
  canViewSpecificUsers: false,
  canMarkCashPaid: false,
  commissionType: "FIXED",
  commissionValue: "0",
};

export default function AdminAgentEditPage() {
  const router = useRouter();
  const { userId } = router.query;
  const [agent, setAgent] = useState(null);
  const [permission, setPermission] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setStatus("");
      try {
        const [agentRes, permRes] = await Promise.all([
          fetch("/api/admin/agents", {
            method: "GET",
            credentials: "include",
          }),
          fetch("/api/admin/agent-permissions", {
            method: "GET",
            credentials: "include",
          }),
        ]);

        const agentData = await agentRes.json();
        if (!agentRes.ok) {
          throw new Error(agentData?.error || "Failed to load agents");
        }

        const permData = await permRes.json();
        if (!permRes.ok) {
          throw new Error(permData?.error || "Failed to load permissions");
        }

        const foundAgent = (agentData.items || []).find((x) => x.id === userId) || null;
        if (!foundAgent) {
          throw new Error("Agent not found");
        }
        const foundPermission =
          (permData.items || []).find((x) => x.userId === userId) || null;

        if (active) {
          setAgent(foundAgent);
          setPermission(foundPermission);
          setForm({
            canEditName: Boolean(foundPermission?.canEditName),
            canViewAllTickets: Boolean(foundPermission?.canViewAllTickets),
            canViewSpecificUsers: Boolean(foundPermission?.canViewSpecificUsers),
            canMarkCashPaid: Boolean(foundPermission?.canMarkCashPaid),
            commissionType: foundPermission?.commissionType || "FIXED",
            commissionValue:
              foundPermission?.commissionValue != null
                ? String(foundPermission.commissionValue)
                : "0",
          });
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [userId]);

  const setBool = (key, checked) => {
    setForm((prev) => ({ ...prev, [key]: checked }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!agent) return;
    setSaving(true);
    setStatus("");
    setError("");
    try {
      const payload = {
        userId: agent.id,
        canEditName: form.canEditName,
        canViewAllTickets: form.canViewAllTickets,
        canViewSpecificUsers: form.canViewSpecificUsers,
        canMarkCashPaid: form.canMarkCashPaid,
        commissionType: form.commissionType,
        commissionValue: Number.parseFloat(form.commissionValue),
      };

      if (!Number.isFinite(payload.commissionValue) || payload.commissionValue < 0) {
        throw new Error("Commission value must be a number >= 0");
      }

      const endpoint = permission
        ? `/api/admin/agent-permissions/${permission.id}`
        : "/api/admin/agent-permissions";
      const method = permission ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save");
      }

      const saved = data.agentPermission;
      setPermission(saved);
      setStatus("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif", maxWidth: 860 }}>
      <div style={{ marginBottom: 14 }}>
        <Link href="/admin/agents">← Back to agents</Link>
      </div>
      <h1 style={{ margin: 0 }}>Edit agent permissions</h1>
      <p style={{ color: "#4b5563", marginTop: 8 }}>
        Configure checkboxes and commission for this agent.
      </p>

      {loading ? <p style={{ marginTop: 16 }}>Loading...</p> : null}
      {error ? <p style={{ marginTop: 16, color: "#b91c1c" }}>{error}</p> : null}

      {!loading && !error && agent ? (
        <form
          onSubmit={save}
          style={{
            marginTop: 16,
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 16,
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>{agent.email}</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>userId: {agent.id}</div>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <Check
              label="canEditName"
              checked={form.canEditName}
              onChange={(v) => setBool("canEditName", v)}
            />
            <Check
              label="canViewAllTickets"
              checked={form.canViewAllTickets}
              onChange={(v) => setBool("canViewAllTickets", v)}
            />
            <Check
              label="canViewSpecificUsers"
              checked={form.canViewSpecificUsers}
              onChange={(v) => setBool("canViewSpecificUsers", v)}
            />
            <Check
              label="canMarkCashPaid"
              checked={form.canMarkCashPaid}
              onChange={(v) => setBool("canMarkCashPaid", v)}
            />
          </div>

          <div
            style={{
              borderTop: "1px solid #e5e7eb",
              paddingTop: 14,
              display: "grid",
              gap: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Commission</h2>
            <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Type</span>
              <select
                value={form.commissionType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, commissionType: e.target.value }))
                }
                style={{
                  height: 36,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "0 8px",
                }}
              >
                <option value="FIXED">fixed</option>
                <option value="PERCENT">%</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, maxWidth: 280 }}>
              <span style={{ fontSize: 13, color: "#374151" }}>Value</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.commissionValue}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, commissionValue: e.target.value }))
                }
                style={{
                  height: 36,
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  padding: "0 10px",
                }}
              />
            </label>
          </div>

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
              {saving ? "Saving..." : "Save"}
            </button>
            {status ? <span style={{ color: "#065f46" }}>{status}</span> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
