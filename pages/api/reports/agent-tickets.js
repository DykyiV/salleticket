import { getCurrentUserFromJwt } from "../../../lib/auth";
import { listTicketsRaw } from "../../../lib/tickets-store";

function parseDateInput(value, fallback) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d;
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getCurrentUserFromJwt(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const rawAgentId = Array.isArray(req.query.agentId) ? req.query.agentId[0] : req.query.agentId;
  const rawDateFrom = Array.isArray(req.query.dateFrom) ? req.query.dateFrom[0] : req.query.dateFrom;
  const rawDateTo = Array.isArray(req.query.dateTo) ? req.query.dateTo[0] : req.query.dateTo;

  const agentId = typeof rawAgentId === "string" ? rawAgentId.trim() : "";
  if (!agentId) {
    return res.status(400).json({ error: "agentId is required" });
  }

  const dateFrom = parseDateInput(rawDateFrom, new Date(0));
  const dateTo = parseDateInput(rawDateTo, new Date("9999-12-31T23:59:59.999Z"));
  if (dateFrom.getTime() > dateTo.getTime()) {
    return res.status(400).json({ error: "dateFrom must be <= dateTo" });
  }

  const tickets = listTicketsRaw()
    .filter((ticket) => {
      if (ticket.agentId !== agentId) return false;
      const created = new Date(ticket.createdAt);
      if (Number.isNaN(created.getTime())) return false;
      return created >= dateFrom && created <= dateTo;
    })
    .map((ticket) => {
      const finalPrice =
        typeof ticket.finalPrice === "number"
          ? ticket.finalPrice
          : Number.parseFloat(String(ticket.finalPrice ?? ticket.price ?? 0));
      return {
        id: ticket.id,
        createdAt: ticket.createdAt,
        fromCity: ticket.fromCity,
        toCity: ticket.toCity,
        finalPrice: Number.isFinite(finalPrice) ? Number(finalPrice.toFixed(2)) : 0,
        commissionAmount: Number(ticket.commissionAmount || 0),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.status(200).json({
    agentId,
    filters: {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    },
    items: tickets,
  });
}
