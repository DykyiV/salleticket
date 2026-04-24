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

  const rawDateFrom = Array.isArray(req.query.dateFrom) ? req.query.dateFrom[0] : req.query.dateFrom;
  const rawDateTo = Array.isArray(req.query.dateTo) ? req.query.dateTo[0] : req.query.dateTo;
  const dateFrom = parseDateInput(rawDateFrom, new Date(0));
  const dateTo = parseDateInput(rawDateTo, new Date("9999-12-31T23:59:59.999Z"));

  if (dateFrom.getTime() > dateTo.getTime()) {
    return res.status(400).json({ error: "dateFrom must be <= dateTo" });
  }

  const tickets = listTicketsRaw();
  const filtered = tickets.filter((ticket) => {
    if (!ticket.agentId) return false;
    const created = new Date(ticket.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return created >= dateFrom && created <= dateTo;
  });

  const map = new Map();
  for (const ticket of filtered) {
    if (!map.has(ticket.agentId)) {
      map.set(ticket.agentId, {
        agentId: ticket.agentId,
        totalTickets: 0,
        totalRevenue: 0,
        totalCommission: 0,
      });
    }
    const row = map.get(ticket.agentId);
    row.totalTickets += 1;
    const finalPrice =
      typeof ticket.finalPrice === "number"
        ? ticket.finalPrice
        : Number.parseFloat(String(ticket.finalPrice ?? ticket.price ?? 0));
    row.totalRevenue += Number.isFinite(finalPrice) ? finalPrice : 0;
    row.totalCommission += Number(ticket.commissionAmount || 0);
  }

  const items = Array.from(map.values())
    .map((row) => ({
      ...row,
      totalRevenue: Number(row.totalRevenue.toFixed(2)),
      totalCommission: Number(row.totalCommission.toFixed(2)),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  const summary = items.reduce(
    (acc, row) => {
      acc.totalTickets += Number(row.totalTickets || 0);
      acc.totalSystemRevenue += Number(row.totalRevenue || 0);
      acc.totalCommissionPaid += Number(row.totalCommission || 0);
      return acc;
    },
    {
      totalTickets: 0,
      totalSystemRevenue: 0,
      totalCommissionPaid: 0,
      netProfit: 0,
    }
  );
  summary.totalSystemRevenue = Number(summary.totalSystemRevenue.toFixed(2));
  summary.totalCommissionPaid = Number(summary.totalCommissionPaid.toFixed(2));
  summary.netProfit = Number(
    (summary.totalSystemRevenue - summary.totalCommissionPaid).toFixed(2)
  );

  return res.status(200).json({
    filters: {
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
    },
    summary,
    items,
  });
}
