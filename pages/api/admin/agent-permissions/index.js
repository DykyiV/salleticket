import {
  COMMISSION_TYPES,
  createAgentPermission,
  listAgentPermissions,
  normalizeAgentPermissionInput,
} from "../../../../lib/agent-permissions-store";

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ items: listAgentPermissions() });
  }

  if (req.method === "POST") {
    const payload = normalizeAgentPermissionInput(req.body || {});

    if (!payload.userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (!payload.commissionType || !COMMISSION_TYPES.includes(payload.commissionType)) {
      return res.status(400).json({ error: "commissionType must be FIXED or PERCENT" });
    }
    if (typeof payload.commissionValue !== "number" || Number.isNaN(payload.commissionValue)) {
      return res.status(400).json({ error: "commissionValue must be a number" });
    }

    const created = createAgentPermission(payload);
    return res.status(201).json({ agentPermission: created });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
