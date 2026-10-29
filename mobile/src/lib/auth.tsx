import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, api, setApiToken, setUnauthorizedHandler } from "@/lib/api";
import { clearCache } from "@/lib/cache";
import { deleteItem, getItem, getJson, setItem, setJson } from "@/lib/storage";
import type { AppUser, SessionAnswer } from "@/lib/types";

/**
 * Sign-in state. The token lives in the phone's keychain; on every launch it
 * is swapped for a fresh one (POST /api/auth/refresh), so an active user is
 * never signed out. Without a connection the saved user is kept, so saved
 * tickets still open offline.
 */

const TOKEN_KEY = "gt_token";
const USER_KEY = "gt_user";

type Status = "loading" | "signedOut" | "signedIn";

type Ctx = {
  status: Status;
  user: AppUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AppUser | null>(null);

  const forget = useCallback(async () => {
    setApiToken(null);
    setUser(null);
    setStatus("signedOut");
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_KEY), clearCache()]);
  }, []);

  const accept = useCallback(async (answer: SessionAnswer) => {
    setApiToken(answer.token);
    setUser(answer.user);
    setStatus("signedIn");
    await Promise.all([setItem(TOKEN_KEY, answer.token), setJson(USER_KEY, answer.user)]);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void forget();
    });
    return () => setUnauthorizedHandler(null);
  }, [forget]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [saved, savedUser] = await Promise.all([getItem(TOKEN_KEY), getJson<AppUser>(USER_KEY)]);
      if (!saved) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      setApiToken(saved);
      try {
        const fresh = await api<SessionAnswer>("/api/auth/refresh", { method: "POST" });
        if (!cancelled) await accept(fresh);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.offline && savedUser) {
          setUser(savedUser);
          setStatus("signedIn");
        } else {
          await forget();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accept, forget]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const answer = await api<SessionAnswer>("/api/auth/login", {
        method: "POST",
        body: { email, password, client: "app" },
        auth: false,
      });
      await accept(answer);
    },
    [accept]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const answer = await api<SessionAnswer>("/api/auth/register", {
        method: "POST",
        body: { email, password, client: "app" },
        auth: false,
      });
      await accept(answer);
    },
    [accept]
  );

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // Offline: the token is still dropped from this phone.
    }
    await forget();
  }, [forget]);

  const value = useMemo(() => ({ status, user, signIn, register, signOut }), [status, user, signIn, register, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
