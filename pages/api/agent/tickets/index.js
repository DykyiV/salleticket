import { getCurrentUserFromJwt } from "../../../../lib/auth";
import { getAgentPermissionByUserId } from "../../../../lib/agent-permissions-store";
import { listTicketsForAgent } from "../../../../lib/tickets-store";

const PAGE_SIZE = 30;

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getCurrentUserFromJwt(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "AGENT" && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const permission =
    getAgentPermissionByUserId(user.id) ?? {
      canEditName: false,
      canViewAllTickets: false,
      canViewSpecificUsers: false,
      canMarkCashPaid: false,
    };

  const pageRaw = Number.parseInt(
    Array.isArray(req.query.page) ? req.query.page[0] : req.query.page || "1",
    10
  );
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const result = listTicketsForAgent({
    userId: user.id,
    page,
    perPage: PAGE_SIZE,
    canViewAllTickets: permission.canViewAllTickets,
  });

  return res.status(200).json({
    ...result,
    permissions: {
      canEditName: permission.canEditName,
      canViewAllTickets: permission.canViewAllTickets,
      canViewSpecificUsers: permission.canViewSpecificUsers,
      canMarkCashPaid: permission.canMarkCashPaid,
    },
  });
}
