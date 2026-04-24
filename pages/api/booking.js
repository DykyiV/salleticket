import { getCurrentUserFromJwt } from "../../lib/auth";
import { getAgentPermissionByUserId } from "../../lib/agent-permissions-store";
import { createTicket } from "../../lib/tickets-store";

function computeCommissionForAgent(permission, ticketPrice) {
  if (!permission) return 0;
  const base = Number(ticketPrice);
  if (!Number.isFinite(base) || base < 0) return 0;

  if (permission.commissionType === "FIXED") {
    const fixed = Number(permission.commissionValue);
    return Number.isFinite(fixed) && fixed > 0 ? fixed : 0;
  }
  if (permission.commissionType === "PERCENT") {
    const percent = Number(permission.commissionValue);
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    return Number((base * (percent / 100)).toFixed(2));
  }
  return 0;
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getCurrentUserFromJwt(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const priceRaw = Object.prototype.hasOwnProperty.call(body, "price")
    ? Number(body.price)
    : 25;
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? Number(priceRaw.toFixed(2)) : 25;

  let commission = 0;
  let commissionType = null;
  let commissionValue = 0;

  if (user.role === "AGENT") {
    const permission = getAgentPermissionByUserId(user.id);
    commission = computeCommissionForAgent(permission, price);
    commissionType = permission?.commissionType ?? null;
    commissionValue = Number(permission?.commissionValue ?? 0);
  }

  const created = createTicket({
    userId: user.id,
    userEmail: user.email || "unknown@asol.bus",
    userName: user.email || user.id,
    price,
    commissionAmount: commission,
    commissionType,
    commissionValue,
    agentId: user.role === "AGENT" ? user.id : null,
  });

  return res.status(201).json({ ticket: created });
}
