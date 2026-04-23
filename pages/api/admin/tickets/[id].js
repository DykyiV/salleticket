import { getTicketById } from "../../../../lib/tickets-store";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const rawId = Array.isArray(id) ? id[0] : id;
  const ticket = getTicketById(rawId);
  if (!ticket) {
    return res.status(404).json({ error: "Ticket not found" });
  }
  return res.status(200).json({ ticket });
}
