import { listTickets } from "../../../../lib/tickets-store";

const PAGE_SIZE = 30;

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const pageParam = Array.isArray(req.query.page) ? req.query.page[0] : req.query.page;
  const pageRaw = Number.parseInt(pageParam || "1", 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const { items, pagination } = listTickets({ page, perPage: PAGE_SIZE });

  return res.status(200).json({
    page: pagination.page,
    pageSize: pagination.perPage,
    total: pagination.total,
    totalPages: pagination.totalPages,
    items,
  });
}
