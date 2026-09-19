import type { DepartureStop } from "@prisma/client";

export type BulkAction =
  | "hideStops"
  | "showStops"
  | "setSaleEnabled"
  | "setStopTime";

export type BulkPayload = {
  departureIds: string[];
  action: BulkAction;
  city?: string | null;
  sortFrom?: number | null;
  sortTo?: number | null;
  outboundTime?: string | null;
  returnTime?: string | null;
  saleEnabled?: boolean;
};

export function stopMatchesFilter(
  stop: Pick<DepartureStop, "city" | "sortOrder">,
  filter: Pick<BulkPayload, "city" | "sortFrom" | "sortTo">
): boolean {
  if (filter.city) {
    if (stop.city.trim().toLowerCase() !== filter.city.trim().toLowerCase()) {
      return false;
    }
  }
  if (filter.sortFrom != null && stop.sortOrder < filter.sortFrom) return false;
  if (filter.sortTo != null && stop.sortOrder > filter.sortTo) return false;
  return true;
}
