"use client";

import { useSyncExternalStore } from "react";

const KEY = "asol_booking_session";

/** Used only if localStorage is unavailable; memoized so the id stays stable. */
let fallbackId: string | null = null;

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
    fallbackId ??= `sess-${Math.random().toString(36).slice(2)}${Date.now()}`;
    return fallbackId;
  }
}

const noopSubscribe = () => () => {};

/**
 * React hook form of getBookingSessionId(): "server" during SSR/hydration,
 * then the persisted browser id — without a setState-in-effect round trip.
 */
export function useBookingSessionId(): string {
  return useSyncExternalStore(noopSubscribe, getBookingSessionId, () => "server");
}
