import {
  getAgentPermissionById,
  normalizeAgentPermissionPatch,
  updateAgentPermission,
} from "../../../../lib/agent-permissions-store";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const rawId = Array.isArray(id) ? id[0] : id;

  if (req.method === "GET") {
    const record = getAgentPermissionById(rawId);
    if (!record) {
      return res.status(404).json({ error: "AgentPermission not found" });
    }
    return res.status(200).json({ agentPermission: record });
  }

  const patch = normalizeAgentPermissionPatch(req.body || {});
  const hasAny = Object.keys(patch).length > 0;
  if (!hasAny) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  if (
    Object.prototype.hasOwnProperty.call(patch, "commissionValue") &&
    patch.commissionValue < 0
  ) {
    return res.status(400).json({ error: "commissionValue must be >= 0" });
  }

  const updated = updateAgentPermission(rawId, patch);
  if (!updated) {
    return res.status(404).json({ error: "AgentPermission not found" });
  }
  return res.status(200).json({ agentPermission: updated });
}
