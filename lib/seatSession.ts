"use client";

const KEY = "asol_booking_session";

/**
 * Stable anonymous booking-session id shared by the results page (seat
 * holds) and the booking page (hold consumption). Lives in localStorage.
 */
export function getBookingSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Math.random().toString(36).slice(2)}${Date.now()}`;
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `sess-${Math.random().toString(36).slice(2)}${Date.now()}`;
  }
}
