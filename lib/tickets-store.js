import fs from "fs";
import path from "path";
import crypto from "crypto";

const STATUSES = ["RESERVED", "PAID_ONLINE", "PAID_CASH", "CANCELLED", "REFUNDED"];
const ROUTES = [
  ["Kyiv", "Lviv"],
  ["Warsaw", "Krakow"],
  ["Prague", "Brno"],
  ["Berlin", "Munich"],
  ["Vienna", "Graz"],
  ["Budapest", "Szeged"],
];

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "tickets.json");

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
      userId: `user-demo-${(index % 24) + 1}`,
      agentId: null,
      userName: `User ${(index % 24) + 1}`,
      userEmail: `user${(index % 24) + 1}@asol.bus`,
      firstName: `Name${(index % 24) + 1}`,
      lastName: `Surname${(index % 24) + 1}`,
      phone: `+38099000${String(index + 1).padStart(4, "0")}`,
      adminComment: null,
      fromCity: route[0],
      toCity: route[1],
      departureTime: departureAt,
      arrivalTime: arrivalAt,
      price: Number((19 + (index % 17) * 2.35).toFixed(2)),
      commissionAmount: 0,
      status: STATUSES[index % STATUSES.length],
      createdAt,
    };
  });
}

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(createMockTickets(), null, 2), "utf8");
  }
}

function readTickets() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function writeTickets(tickets) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(tickets, null, 2), "utf8");
}

export function listTickets({ page = 1, perPage = 30 } = {}) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : 30;

  // Always keep newest tickets first.
  const sorted = [...readTickets()].sort(
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

export function listAllTickets() {
  return readTickets();
}

export function listTicketsForUser(userId, { page = 1, perPage = 30 } = {}) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePerPage = Number.isFinite(perPage) && perPage > 0 ? Math.floor(perPage) : 30;
  const filtered = readTickets().filter((ticket) => ticket.userId === userId);
  const sorted = filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / safePerPage));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePerPage;
  const items = sorted.slice(start, start + safePerPage);
  return {
    items,
    pagination: { page: currentPage, perPage: safePerPage, total, totalPages },
  };
}

export function listTicketsForAgent({
  userId,
  page = 1,
  perPage = 30,
  canViewAllTickets = false,
} = {}) {
  if (canViewAllTickets) {
    return listTickets({ page, perPage });
  }
  return listTicketsForUser(userId, { page, perPage });
}

export function listTicketsRaw() {
  return readTickets();
}

export function getTicketById(ticketId) {
  return readTickets().find((ticket) => ticket.id === ticketId) ?? null;
}

export function updateTicketAdminFields(ticketId, patch) {
  const tickets = readTickets();
  const idx = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (idx === -1) return null;

  const next = { ...tickets[idx] };
  if (typeof patch.firstName === "string") next.firstName = patch.firstName.trim();
  if (typeof patch.lastName === "string") next.lastName = patch.lastName.trim();
  if (typeof patch.phone === "string") next.phone = patch.phone.trim();
  if (Object.prototype.hasOwnProperty.call(patch, "adminComment")) {
    if (patch.adminComment == null) {
      next.adminComment = null;
    } else if (typeof patch.adminComment === "string") {
      const normalized = patch.adminComment.trim();
      next.adminComment = normalized === "" ? null : normalized;
    }
  }

  tickets[idx] = next;
  writeTickets(tickets);
  return next;
}

export function normalizeTicketUpdate(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};

  if (Object.prototype.hasOwnProperty.call(src, "firstName")) {
    out.firstName = typeof src.firstName === "string" ? src.firstName.trim() : "";
  }
  if (Object.prototype.hasOwnProperty.call(src, "lastName")) {
    out.lastName = typeof src.lastName === "string" ? src.lastName.trim() : "";
  }
  if (Object.prototype.hasOwnProperty.call(src, "phone")) {
    out.phone = typeof src.phone === "string" ? src.phone.trim() : "";
  }
  if (Object.prototype.hasOwnProperty.call(src, "adminComment")) {
    if (src.adminComment == null) {
      out.adminComment = null;
    } else if (typeof src.adminComment === "string") {
      const normalized = src.adminComment.trim();
      out.adminComment = normalized === "" ? null : normalized;
    } else {
      out.adminComment = null;
    }
  }

  return out;
}

export function updateTicketById(ticketId, patch) {
  return updateTicketAdminFields(ticketId, patch);
}

export function markTicketCashPaid(ticketId) {
  const tickets = readTickets();
  const idx = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (idx === -1) return null;
  const next = { ...tickets[idx], status: "PAID_CASH", updatedAt: new Date().toISOString() };
  tickets[idx] = next;
  writeTickets(tickets);
  return next;
}

function nextTicketId() {
  return `TCK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function createTicket(input) {
  const src = input && typeof input === "object" ? input : {};
  const tickets = readTickets();
  const now = new Date().toISOString();
  const priceRaw =
    typeof src.price === "number" ? src.price : Number.parseFloat(String(src.price ?? ""));
  const price = Number.isFinite(priceRaw) && priceRaw > 0 ? Number(priceRaw.toFixed(2)) : 25;
  const commissionAmountRaw =
    typeof src.commissionAmount === "number"
      ? src.commissionAmount
      : Number.parseFloat(String(src.commissionAmount ?? ""));
  const commissionAmount = Number.isFinite(commissionAmountRaw)
    ? Number(commissionAmountRaw.toFixed(2))
    : 0;

  const row = {
    id: nextTicketId(),
    userId: typeof src.userId === "string" && src.userId.trim() ? src.userId.trim() : "guest",
    agentId: typeof src.agentId === "string" && src.agentId.trim() ? src.agentId.trim() : null,
    userName:
      typeof src.userName === "string" && src.userName.trim() ? src.userName.trim() : "Guest",
    userEmail:
      typeof src.userEmail === "string" && src.userEmail.trim()
        ? src.userEmail.trim().toLowerCase()
        : null,
    firstName: typeof src.firstName === "string" ? src.firstName.trim() : "Passenger",
    lastName: typeof src.lastName === "string" ? src.lastName.trim() : "One",
    phone: typeof src.phone === "string" ? src.phone.trim() : "",
    adminComment: null,
    fromCity: typeof src.fromCity === "string" ? src.fromCity : "Kyiv",
    toCity: typeof src.toCity === "string" ? src.toCity : "Lviv",
    departureTime:
      typeof src.departureTime === "string"
        ? src.departureTime
        : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    arrivalTime:
      typeof src.arrivalTime === "string"
        ? src.arrivalTime
        : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    price,
    status: "RESERVED",
    createdAt: now,
    updatedAt: now,
    commissionType: src.commissionType ?? null,
    commissionValue:
      typeof src.commissionValue === "number" ? src.commissionValue : src.commissionValue ?? null,
    commissionAmount,
  };

  tickets.push(row);
  writeTickets(tickets);
  return row;
}
