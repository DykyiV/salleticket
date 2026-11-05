import type { Role } from "@prisma/client";

/**
 * Who changes a ticket's date or seat (both directions, paid or not):
 * dispatchers and managers until the day of departure, admins any time.
 * Passengers send a change request instead.
 */
const CHANGERS = new Set<Role>(["DISPATCHER", "MANAGER", "ADMIN", "SUPER_ADMIN"]);
const ADMINS = new Set<Role>(["ADMIN", "SUPER_ADMIN"]);

/** Today in Kyiv, YYYY-MM-DD. */
function kyivToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Why this user can't change the leg departing at `departure` (null = can). */
export function tripChangeRefusal(role: Role, departure: Date | null | undefined, now = new Date()): string | null {
  if (!CHANGERS.has(role)) return "Дату чи місце змінює менеджер або диспетчер — надішліть запит на зміну.";
  if (ADMINS.has(role) || !departure) return null;
  // Departure times are stored as local time, so their date part is the day of departure.
  if (kyivToday(now) > departure.toISOString().slice(0, 10)) {
    return "Рейс уже відбувся — змінити дату чи місце може лише адміністратор.";
  }
  return null;
}
