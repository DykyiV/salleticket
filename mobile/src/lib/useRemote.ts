import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ApiError } from "@/lib/api";
import type { Cached } from "@/lib/cache";

export type RemoteState<T> = {
  data: T | null;
  /** True when the server could not be reached and `data` is the saved copy. */
  offline: boolean;
  /** HTTP status of the last failure (404 etc.), 0 when offline. */
  errorStatus: number | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
};

/**
 * Server data for a screen that must always be current: loaded every time the
 * screen comes into focus and every time the app returns to the foreground
 * (the old app only loaded «Мої квитки» once, so tickets bought elsewhere did
 * not appear). The last good answer is kept for offline use.
 *
 * `fetcher` and `cache` must be stable (useCallback / useMemo / module const).
 * Mount the screen part that uses this hook only for a signed-in user, keyed
 * by the user, so one account's data never shows for another.
 */
export function useRemote<T>(
  fetcher: () => Promise<T>,
  cache: { load: () => Promise<Cached<T> | null>; save: (data: T) => Promise<void> }
): RemoteState<T> {
  const [data, setData] = useState<T | null>(null);
  const [offline, setOffline] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(
    async (pull: boolean) => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (pull) setRefreshing(true);
      try {
        const fresh = await fetcher();
        setData(fresh);
        setOffline(false);
        setErrorStatus(null);
        void cache.save(fresh);
      } catch (err) {
        const status = err instanceof ApiError ? err.status : -1;
        setErrorStatus(status);
        if (status === 0) {
          const saved = await cache.load();
          if (saved) setData((current) => current ?? saved.data);
          setOffline(true);
        }
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetcher, cache]
  );

  // Show the saved copy at once while the network answer is on its way.
  useEffect(() => {
    let cancelled = false;
    cache.load().then((saved) => {
      if (!cancelled && saved) setData((current) => current ?? saved.data);
    });
    return () => {
      cancelled = true;
    };
  }, [cache]);

  useFocusEffect(
    useCallback(() => {
      void run(false);
    }, [run])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void run(false);
    });
    return () => sub.remove();
  }, [run]);

  const refresh = useCallback(() => void run(true), [run]);
  return { data, offline, errorStatus, loading, refreshing, refresh };
}
