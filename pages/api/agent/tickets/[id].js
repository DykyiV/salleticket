import { getCurrentUserFromJwt } from "../../../../lib/auth";
import {
  getAgentPermissionByUserId,
  hasAgentPermission,
} from "../../../../lib/agent-permissions-store";
import {
  getTicketById,
  markTicketCashPaid,
  normalizeTicketUpdate,
  updateTicketById,
} from "../../../../lib/tickets-store";

function isAgentRole(user) {
  if (!user) return false;
  return user.role === "AGENT" || user.role === "ADMIN" || user.role === "SUPER_ADMIN";
}

export default function handler(req, res) {
  const user = getCurrentUserFromJwt(req);
  if (!isAgentRole(user)) {
    return res.status(403).json({ error: "Agent access required" });
  }

  const permission = getAgentPermissionByUserId(user.id) || null;
  const { id } = req.query;
  const rawId = Array.isArray(id) ? id[0] : id;
  const ticket = getTicketById(rawId);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }

  const canViewAll = hasAgentPermission(permission, "canViewAllTickets");
  const canViewOwn = ticket.userId === user.id;
  if (!canViewAll && !canViewOwn) {
    return res.status(403).json({ error: "Forbidden: ticket not visible for this agent" });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ticket,
      permissions: {
        canEditName: hasAgentPermission(permission, "canEditName"),
        canMarkCashPaid: hasAgentPermission(permission, "canMarkCashPaid"),
        canViewAllTickets: canViewAll,
      },
    });
  }

  if (req.method === "PATCH") {
    const payload = req.body && typeof req.body === "object" ? req.body : {};

    if (payload.action === "markCashPaid") {
      if (!hasAgentPermission(permission, "canMarkCashPaid")) {
        return res.status(403).json({ error: "Forbidden: canMarkCashPaid is false" });
      }
      const updatedCash = markTicketCashPaid(rawId);
      return res.status(200).json({ ticket: updatedCash, action: "markCashPaid" });
    }

    if (!hasAgentPermission(permission, "canEditName")) {
      return res.status(403).json({ error: "Forbidden: canEditName is false" });
    }

    const normalized = normalizeTicketUpdate(payload);
    const editPatch = {};
    if (Object.prototype.hasOwnProperty.call(normalized, "firstName")) {
      editPatch.firstName = normalized.firstName;
    }
    if (Object.prototype.hasOwnProperty.call(normalized, "lastName")) {
      editPatch.lastName = normalized.lastName;
    }
    if (Object.prototype.hasOwnProperty.call(normalized, "phone")) {
      editPatch.phone = normalized.phone;
    }

    if (Object.keys(editPatch).length === 0) {
      return res.status(400).json({
        error: "Nothing to update. Provide firstName, lastName, or phone.",
      });
    }
    if (Object.prototype.hasOwnProperty.call(editPatch, "firstName") && !editPatch.firstName) {
      return res.status(400).json({ error: "firstName cannot be empty" });
    }
    if (Object.prototype.hasOwnProperty.call(editPatch, "lastName") && !editPatch.lastName) {
      return res.status(400).json({ error: "lastName cannot be empty" });
    }
    if (Object.prototype.hasOwnProperty.call(editPatch, "phone") && !editPatch.phone) {
      return res.status(400).json({ error: "phone cannot be empty" });
    }

    const updated = updateTicketById(rawId, editPatch);
    return res.status(200).json({ ticket: updated, action: "edit" });
  }

  res.setHeader("Allow", "GET, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
