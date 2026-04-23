import { getTicketById } from "../../../../lib/tickets-store";

export default function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const rawId = Array.isArray(id) ? id[0] : id;
  if (req.method === "GET") {
    const ticket = getTicketById(rawId);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    return res.status(200).json({ ticket });
  }
  const {
    updateTicketById,
    normalizeTicketUpdate,
  } = require("../../../../lib/tickets-store");

  const payload = normalizeTicketUpdate(req.body || {});
  const hasAny =
    Object.prototype.hasOwnProperty.call(payload, "firstName") ||
    Object.prototype.hasOwnProperty.call(payload, "lastName") ||
    Object.prototype.hasOwnProperty.call(payload, "phone") ||
    Object.prototype.hasOwnProperty.call(payload, "adminComment");

  if (!hasAny) {
    return res.status(400).json({
      error: "Nothing to update. Provide firstName, lastName, phone, or adminComment.",
    });
  }

  if (Object.prototype.hasOwnProperty.call(payload, "firstName") && !payload.firstName) {
    return res.status(400).json({ error: "firstName cannot be empty" });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "lastName") && !payload.lastName) {
    return res.status(400).json({ error: "lastName cannot be empty" });
  }
  if (Object.prototype.hasOwnProperty.call(payload, "phone") && !payload.phone) {
    return res.status(400).json({ error: "phone cannot be empty" });
  }

  const updated = updateTicketById(rawId, payload);
  if (!updated) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  return res.status(200).json({ ticket: updated });
}
