import { beforeEach, describe, expect, it, vi } from "vitest";

// What reaches Sentry: issues (→ e-mail to the owner) and the «site is alive» check-in.
const sentry = vi.hoisted(() => ({ issues: [] as { fingerprint: string[]; message: string }[], checkIns: 0 }));
vi.mock("@sentry/nextjs", () => ({
  withScope: (run: (scope: unknown) => void) => {
    let fingerprint: string[] = [];
    run({ setFingerprint: (f: string[]) => (fingerprint = f), setLevel: () => {}, setExtras: () => {} });
    sentry.issues[sentry.issues.length - 1].fingerprint = fingerprint;
  },
  captureMessage: (message: string) => sentry.issues.push({ fingerprint: [], message }),
  captureCheckIn: () => (sentry.checkIns += 1),
}));

const world = vi.hoisted(() => ({ dbUp: true, gtUp: true }));
vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: async () => (world.dbUp ? [{ 1: 1 }] : Promise.reject(new Error("db is gone"))) },
}));
vi.mock("@/lib/carriers/grandes-tour/client", () => ({
  grandesTourEnabled: () => true,
  gtCall: async () => (world.gtUp ? { cities: [] } : Promise.reject(new Error("Grandes Tour /api/v3/cache/cities: HTTP 502"))),
}));

const MIN = 60_000;
const T0 = Date.parse("2026-11-17T10:00:00Z");

beforeEach(() => {
  vi.resetModules();
  sentry.issues = [];
  sentry.checkIns = 0;
  world.dbUp = true;
  world.gtUp = true;
});

describe("alertOwner", () => {
  it("sends a problem once, not on every repeat within the quiet period", async () => {
    const { alertOwner } = await import("@/lib/alerts");
    alertOwner(["gt-reverse-trip", "Севілія - Вінниця"], "зустрічний автобус", {}, T0);
    alertOwner(["gt-reverse-trip", "Севілія - Вінниця"], "зустрічний автобус", {}, T0 + 60 * MIN);
    alertOwner(["gt-reverse-trip", "Мадрид - Київ"], "зустрічний автобус", {}, T0 + 60 * MIN);
    alertOwner(["gt-reverse-trip", "Севілія - Вінниця"], "зустрічний автобус", {}, T0 + 25 * 60 * MIN);
    expect(sentry.issues.map((i) => i.fingerprint.join("/"))).toEqual([
      "gt-reverse-trip/Севілія - Вінниця",
      "gt-reverse-trip/Мадрид - Київ",
      "gt-reverse-trip/Севілія - Вінниця",
    ]);
  });
});

describe("checkHealth", () => {
  it("reports «alive» to Sentry while the site and its database work", async () => {
    const { checkHealth } = await import("@/lib/health");
    expect(await checkHealth(T0)).toEqual({ db: true, gt: true });
    expect(sentry.checkIns).toBe(1);
    expect(sentry.issues).toEqual([]);
    // Asked again within a minute: the same answer, nothing is probed or sent twice.
    world.gtUp = false;
    expect(await checkHealth(T0 + 30_000)).toEqual({ db: true, gt: true });
    expect(sentry.checkIns).toBe(1);
  });

  it("stays silent when the database is down, so Sentry notices the missing check-in", async () => {
    world.dbUp = false;
    const { checkHealth } = await import("@/lib/health");
    expect(await checkHealth(T0)).toEqual({ db: false, gt: true });
    expect(sentry.checkIns).toBe(0);
  });

  it("alerts when Grandes Tour fails two probes in a row, once a day", async () => {
    const { checkHealth } = await import("@/lib/health");
    world.gtUp = false;
    expect(await checkHealth(T0)).toEqual({ db: true, gt: false });
    expect(sentry.issues).toEqual([]); // one failure can be a blip
    await checkHealth(T0 + 5 * MIN);
    await checkHealth(T0 + 10 * MIN);
    expect(sentry.issues).toHaveLength(1);
    expect(sentry.issues[0].fingerprint).toEqual(["gt-down", "2026-11-17"]);
    expect(sentry.issues[0].message).toContain("Grandes Tour");
    // The site itself is fine all this time.
    expect(sentry.checkIns).toBe(3);

    // Back up and down again the next day: a new issue, so a new e-mail.
    world.gtUp = true;
    await checkHealth(T0 + 15 * MIN);
    world.gtUp = false;
    await checkHealth(T0 + 24 * 60 * MIN);
    await checkHealth(T0 + 24 * 60 * MIN + 5 * MIN);
    expect(sentry.issues.map((i) => i.fingerprint[1])).toEqual(["2026-11-17", "2026-11-18"]);
  });
});
