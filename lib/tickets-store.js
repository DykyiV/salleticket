const STATUSES = ["RESERVED", "PAID_ONLINE", "PAID_CASH", "CANCELLED", "REFUNDED"];
const ROUTES = [
  ["Kyiv", "Lviv"],
  ["Warsaw", "Krakow"],
  ["Prague", "Brno"],
  ["Berlin", "Munich"],
  ["Vienna", "Graz"],
  ["Budapest", "Szeged"],
];

function createMockTickets(count = 137) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const route = ROUTES[index % ROUTES.length];
    const createdAt = new Date(now - index * 1000 * 60 * 13).toISOString();
    const departureAt = new Date(now + (index % 12) * 1000 * 60 * 60 * 3).toISOString();
    const arrivalAt = new Date(
      new Date(departureAt).getTime() + (2 + (index % 6)) * 1000 * 60 * 60
    ).toISOString();
    return {
      id: `TCK-${String(index + 1).padStart(6, "0")}`,
      userName: `User ${(index % 24) + 1}`,
      userEmail: `user${(index % 24) + 1}@asol.bus`,
      fromCity: route[0],
      toCity: route[1],
      departureTime: departureAt,
      arrivalTime: arrivalAt,
      price: Number((19 + (index % 17) * 2.35).toFixed(2)),
      status: STATUSES[index % STATUSES.length],
      createdAt,
    };
  });
}

const tickets = createMockTickets();

export function listTickets({ page = 1, perPage = 30 } = {}) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : 30;

  // Always keep newest tickets first.
  const sorted = [...tickets].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / safePerPage));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePerPage;
  const items = sorted.slice(start, start + safePerPage);

  return {
    items,
    pagination: {
      page: currentPage,
      perPage: safePerPage,
      total,
      totalPages,
    },
  };
}

export function getTicketById(ticketId) {
  return tickets.find((ticket) => ticket.id === ticketId) ?? null;
}
