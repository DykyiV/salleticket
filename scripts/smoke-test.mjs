/**
 * Smoke tests for the Asol BUS API.
 *
 * Expects a running server (BASE_URL, default http://localhost:3100) with a
 * migrated + seeded database. Exits with code 1 on the first failed check.
 *
 * Usage:
 *   npm run start -- -p 3100 &
 *   node scripts/smoke-test.mjs
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100";

let passed = 0;
let failed = 0;

function check(name, condition, details = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✔ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✘ ${name}${details ? ` — ${details}` : ""}`);
  }
}

/** Wait until the server answers or the timeout elapses. */
async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL, { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${BASE_URL} did not start within ${timeoutMs}ms`);
}

/** Extract the asol_session cookie value from a response. */
function sessionCookie(res) {
  const raw = res.headers.get("set-cookie") ?? "";
  const match = raw.match(/asol_session=([^;]*)/);
  return match ? `asol_session=${match[1]}` : null;
}

async function main() {
  console.log(`Smoke tests against ${BASE_URL}\n`);
  await waitForServer();

  // --- Public pages -------------------------------------------------------
  const home = await fetch(BASE_URL, { redirect: "manual" });
  check("GET / returns 200", home.status === 200, `got ${home.status}`);

  const results = await fetch(`${BASE_URL}/results?from=Kyiv&to=Lviv&date=2026-10-01`);
  check("GET /results returns 200", results.status === 200, `got ${results.status}`);

  // --- Search -------------------------------------------------------------
  const searchRes = await fetch(`${BASE_URL}/api/search?from=Kyiv&to=Lviv&date=2026-10-01`);
  const search = await searchRes.json();
  check("GET /api/search returns trips", searchRes.ok && search.trips?.length > 0);
  const trip = search.trips?.[1] ?? search.trips?.[0];

  const flightRes = await fetch(`${BASE_URL}/api/search?from=Kyiv&to=Madrid&transport=FLIGHT`);
  const flights = await flightRes.json();
  check(
    "GET /api/search?transport=FLIGHT returns only flights",
    flightRes.ok &&
      flights.trips?.length > 0 &&
      flights.trips.every((t) => t.transportType === "FLIGHT")
  );

  const trainRes = await fetch(`${BASE_URL}/api/search?from=Kyiv&to=Lviv&transport=TRAIN`);
  const trains = await trainRes.json();
  check(
    "GET /api/search?transport=TRAIN returns only trains",
    trainRes.ok &&
      trains.trips?.length > 0 &&
      trains.trips.every((t) => t.transportType === "TRAIN")
  );

  // --- Auth ---------------------------------------------------------------
  const email = `smoke-${Date.now()}@example.com`;
  const password = "smoke-test-password-1";

  const register = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = sessionCookie(register);
  check("POST /api/auth/register creates a user", register.status === 200 || register.status === 201, `got ${register.status}`);
  check("register sets the session cookie", Boolean(cookie));

  const dup = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  check("duplicate register returns 409", dup.status === 409, `got ${dup.status}`);

  const authHeaders = { "Content-Type": "application/json", Cookie: cookie };

  const me = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Cookie: cookie } });
  const meBody = await me.json();
  check("GET /api/auth/me returns the user", meBody.user?.email === email);

  const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  check("login with wrong password returns 401", badLogin.status === 401, `got ${badLogin.status}`);

  // --- Promo ---------------------------------------------------------------
  const promo = await fetch(`${BASE_URL}/api/promo/check?code=DISCOUNT10`);
  const promoBody = await promo.json();
  check("GET /api/promo/check validates DISCOUNT10", promoBody.ok === true);

  // --- Booking --------------------------------------------------------------
  const bookingPayload = {
    tripId: trip.id,
    carrierId: trip.carrierId,
    promoCode: "DISCOUNT10",
    passenger: { name: "Smoke Test", phone: "+380991234567", ageCategory: "ADULT" },
    tripSnapshot: {
      from: trip.from,
      to: trip.to,
      date: "2026-10-01",
      // Deliberately tampered price — the server must ignore it.
      price: 0.01,
    },
  };

  const noAuth = await fetch(`${BASE_URL}/api/booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookingPayload),
  });
  check("POST /api/booking without auth returns 401", noAuth.status === 401, `got ${noAuth.status}`);

  const booking = await fetch(`${BASE_URL}/api/booking`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(bookingPayload),
  });
  const bookingBody = await booking.json();
  check("POST /api/booking creates a booking", booking.status === 201, `got ${booking.status}: ${JSON.stringify(bookingBody).slice(0, 200)}`);

  const expectedFinal = Math.round(trip.price * 0.9 * 100) / 100; // DISCOUNT10 = 10%
  check(
    "server-side price ignores client tampering (base price kept)",
    bookingBody.booking?.basePrice === trip.price,
    `expected ${trip.price}, got ${bookingBody.booking?.basePrice}`
  );
  check(
    "promo discount applied correctly",
    bookingBody.booking?.finalPrice === expectedFinal,
    `expected ${expectedFinal}, got ${bookingBody.booking?.finalPrice}`
  );

  const list = await fetch(`${BASE_URL}/api/booking`, { headers: { Cookie: cookie } });
  const listBody = await list.json();
  check(
    "GET /api/booking lists the new booking",
    listBody.bookings?.some((b) => b.reference === bookingBody.booking?.reference)
  );

  // --- Route protection ------------------------------------------------------
  const account = await fetch(`${BASE_URL}/account`, { redirect: "manual" });
  const accountLocation = account.headers.get("location") ?? "";
  check(
    "GET /account without auth redirects to /login",
    [301, 302, 307, 308].includes(account.status) && accountLocation.includes("/login"),
    `got ${account.status} -> ${accountLocation}`
  );

  const adminApi = await fetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: cookie } });
  check("GET /api/admin/users as USER returns 403", adminApi.status === 403, `got ${adminApi.status}`);

  const settlementsApi = await fetch(`${BASE_URL}/api/admin/settlements`, { headers: { Cookie: cookie } });
  check("GET /api/admin/settlements as USER returns 403", settlementsApi.status === 403, `got ${settlementsApi.status}`);

  const cronNoAuth = await fetch(`${BASE_URL}/api/cron/settlements`, { method: "POST" });
  check(
    "POST /api/cron/settlements without secret returns 401/503",
    [401, 503].includes(cronNoAuth.status),
    `got ${cronNoAuth.status}`
  );

  // --- Logout -----------------------------------------------------------------
  const logout = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  const logoutCookie = sessionCookie(logout);
  check("POST /api/auth/logout succeeds", logout.ok);

  const meAfter = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: logoutCookie ?? cookie },
  });
  const meAfterBody = await meAfter.json();
  check("session is cleared after logout", meAfterBody.user === null);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
