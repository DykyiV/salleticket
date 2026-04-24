import { listUsersByRole } from "../../../../lib/users-store";
import { listAgentPermissions } from "../../../../lib/agent-permissions-store";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const agents = listUsersByRole(["AGENT"]);
  const permissions = listAgentPermissions();
  const byUserId = new Map(permissions.map((item) => [item.userId, item]));

  const items = agents.map((agent) => ({
    ...agent,
    permission: byUserId.get(agent.id) || null,
  }));

  return res.status(200).json({ items });
}
