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
  // Coaches assign seats: take the first free standard-price seat (mult 1) so
  // the price assertions below stay exact, even when the DB is reused.
  const seatsRes = await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(trip.id)}/seats`);
  const seatsBody = await seatsRes.json();
  const freeSeats = (seatsBody.layout?.decks ?? [])
    .flatMap((d) => d.rows.flat())
    .map((cell) => cell.seat)
    .filter((seat) => seat && seat.status === "AVAILABLE" && seat.mult === 1);
  const freeSeat = freeSeats[1] ?? freeSeats[0];
  const guestSeat = freeSeats[0];
  check("GET /api/trips/[id]/seats offers a free seat", seatsRes.ok && Boolean(freeSeat), `got ${seatsRes.status}`);

  const bookingPayload = {
    seatNumber: freeSeat?.number ?? null,
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
    body: JSON.stringify({
      ...bookingPayload,
      promoCode: undefined,
      seatNumber: guestSeat?.number ?? null,
    }),
  });
  const noAuthBody = await noAuth.json();
  const guestCookie = (noAuth.headers.get("set-cookie") ?? "").match(/asol_guest=[^;]+/)?.[0];
  check(
    "POST /api/booking without auth saves the ticket for later sign-in",
    noAuth.status === 201 && noAuthBody.needsAccount === true && Boolean(guestCookie),
    `got ${noAuth.status}`
  );

  const claimEmail = `claim-${Date.now()}@example.com`;
  const claim = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: guestCookie ?? "" },
    body: JSON.stringify({ email: claimEmail, password }),
  });
  const claimBody = await claim.json();
  check(
    "register attaches the guest ticket to the new account",
    claim.status === 201 && claimBody.claimed === 1,
    `got ${claim.status} claimed=${claimBody.claimed}`
  );

  const booking = await fetch(`${BASE_URL}/api/booking`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(bookingPayload),
  });
  const bookingBody = await booking.json();
  check("POST /api/booking creates a booking", booking.status === 201, `got ${booking.status}: ${JSON.stringify(bookingBody).slice(0, 200)}`);

  const expectedFinal = Math.round(trip.price * 0.9 * 100) / 100; // DISCOUNT10 = 10%, cash on bus
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

  // --- Passenger editing (/api/account/tickets/[id]/passenger) -------------
  const detail = await fetch(
    `${BASE_URL}/api/booking?reference=${bookingBody.booking?.reference}`,
    { headers: { Cookie: cookie } }
  );
  const detailBody = await detail.json();
  const ownTicketId = detailBody.booking?.ticket?.id;
  const reference = bookingBody.booking?.reference;
  check("GET /api/booking?reference= returns the ticket id", Boolean(ownTicketId));

  const ticketApi = (id, sub) => `${BASE_URL}/api/account/tickets/${id}/${sub}`;

  const passNoAuth = await fetch(ticketApi(ownTicketId, "passenger"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName: "Hacked" }),
  });
  check("PATCH passenger without auth returns 401", passNoAuth.status === 401, `got ${passNoAuth.status}`);

  const passNotFound = await fetch(ticketApi("nonexistent-id", "passenger"), {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ firstName: "Hacked" }),
  });
  check("PATCH passenger on missing ticket returns 404", passNotFound.status === 404, `got ${passNotFound.status}`);

  const ownEdit = await fetch(ticketApi(ownTicketId, "passenger"), {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ firstName: "Edited", phone: "+380501112233" }),
  });
  const ownEditBody = await ownEdit.json();
  check(
    "owner can edit own passenger details",
    ownEdit.status === 200 &&
      ownEditBody.changed === true &&
      ownEditBody.booking?.firstName === "Edited" &&
      ownEditBody.booking?.phone === "+380501112233",
    `got ${ownEdit.status}: ${JSON.stringify(ownEditBody).slice(0, 200)}`
  );

  // --- Ticket comments ---------------------------------------------------------
  const commentNoAuth = await fetch(ticketApi(ownTicketId, "comments"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "hi" }),
  });
  check("POST comments without auth returns 401", commentNoAuth.status === 401, `got ${commentNoAuth.status}`);

  const commentEmpty = await fetch(ticketApi(ownTicketId, "comments"), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ text: "  " }),
  });
  check("POST comments with empty text returns 400", commentEmpty.status === 400, `got ${commentEmpty.status}`);

  const commentAdd = await fetch(ticketApi(ownTicketId, "comments"), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ text: "Smoke comment" }),
  });
  check("owner can add a comment to own ticket", commentAdd.status === 201, `got ${commentAdd.status}`);

  const commentList = await fetch(ticketApi(ownTicketId, "comments"), { headers: { Cookie: cookie } });
  const commentListBody = await commentList.json();
  check(
    "GET comments lists the new comment",
    commentList.status === 200 && commentListBody.comments?.some((c) => c.text === "Smoke comment"),
    `got ${commentList.status}`
  );

  // --- PDF tickets -----------------------------------------------------------
  const pdfNoAuth = await fetch(`${BASE_URL}/api/tickets/${reference}/pdf`);
  check("GET /api/tickets/[reference]/pdf without auth returns 401", pdfNoAuth.status === 401, `got ${pdfNoAuth.status}`);

  const ownPdf = await fetch(`${BASE_URL}/api/tickets/${reference}/pdf`, { headers: { Cookie: cookie } });
  const pdfBytes = Buffer.from(await ownPdf.arrayBuffer());
  check(
    "owner can download own ticket PDF",
    ownPdf.status === 200 &&
      ownPdf.headers.get("content-type") === "application/pdf" &&
      pdfBytes.subarray(0, 5).toString() === "%PDF-",
    `got ${ownPdf.status} ${ownPdf.headers.get("content-type")}`
  );

  const bulkPdfAsCustomer = await fetch(`${BASE_URL}/api/tickets/bulk-pdf?ids=${ownTicketId}`, {
    headers: { Cookie: cookie },
  });
  check("GET /api/tickets/bulk-pdf as CUSTOMER returns 403", bulkPdfAsCustomer.status === 403, `got ${bulkPdfAsCustomer.status}`);

  // --- Bulk SMS ---------------------------------------------------------------
  const smsNoAuth = await fetch(`${BASE_URL}/api/admin/sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticketIds: [ownTicketId], message: "test" }),
  });
  check("POST /api/admin/sms without auth returns 401", smsNoAuth.status === 401, `got ${smsNoAuth.status}`);

  const smsAsCustomer = await fetch(`${BASE_URL}/api/admin/sms`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ ticketIds: [ownTicketId], message: "test" }),
  });
  check("POST /api/admin/sms as CUSTOMER returns 403", smsAsCustomer.status === 403, `got ${smsAsCustomer.status}`);

  // --- Route protection ------------------------------------------------------
  const cabinet = await fetch(`${BASE_URL}/cabinet`, { redirect: "manual" });
  const cabinetLocation = cabinet.headers.get("location") ?? "";
  check(
    "GET /cabinet without auth redirects to /login",
    [301, 302, 307, 308].includes(cabinet.status) && cabinetLocation.includes("/login"),
    `got ${cabinet.status} -> ${cabinetLocation}`
  );

  const adminApi = await fetch(`${BASE_URL}/api/admin/users`, { headers: { Cookie: cookie } });
  check("GET /api/admin/users as CUSTOMER returns 403", adminApi.status === 403, `got ${adminApi.status}`);

  const autoCronNoAuth = await fetch(`${BASE_URL}/api/cron/auto-reports`, { method: "POST" });
  check("POST /api/cron/auto-reports without secret returns 401/503", [401, 503].includes(autoCronNoAuth.status), `got ${autoCronNoAuth.status}`);

  const cronNoAuth = await fetch(`${BASE_URL}/api/cron/settlements`, { method: "POST" });
  check("POST /api/cron/settlements without secret returns 401/503", [401, 503].includes(cronNoAuth.status), `got ${cronNoAuth.status}`);

  // --- Finance: permission-gated (finance.read / finance.edit) ---------------
  const financeUrls = [
    "/api/finance/settlements",
    "/api/finance/commissions",
    "/api/finance/carrier-report/csv",
    "/api/finance/reconciliation",
    "/api/finance/auto-reports",
    "/api/finance/payments",
  ];
  for (const url of financeUrls) {
    const res = await fetch(`${BASE_URL}${url}`, { headers: { Cookie: cookie } });
    check(`GET ${url} as CUSTOMER returns 403`, res.status === 403, `got ${res.status}`);
  }

  const login = async (loginEmail, loginPassword) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    return res.ok ? sessionCookie(res) : null;
  };

  const agentCookie = await login("agent@asolbus.local", "Agent12345");
  check("seeded agent can log in", Boolean(agentCookie));
  if (agentCookie) {
    const agentFinance = await fetch(`${BASE_URL}/api/finance/settlements`, { headers: { Cookie: agentCookie } });
    check("GET /api/finance/settlements as AGENT returns 403", agentFinance.status === 403, `got ${agentFinance.status}`);
    const agentRecon = await fetch(`${BASE_URL}/api/finance/reconciliation`, { headers: { Cookie: agentCookie } });
    check("GET /api/finance/reconciliation as AGENT returns 403", agentRecon.status === 403, `got ${agentRecon.status}`);
    const agentBulk = await fetch(`${BASE_URL}/api/tickets/bulk-pdf?ids=${ownTicketId}`, { headers: { Cookie: agentCookie } });
    check("GET /api/tickets/bulk-pdf as AGENT returns a PDF", agentBulk.status === 200 && agentBulk.headers.get("content-type") === "application/pdf", `got ${agentBulk.status}`);

    // Agent takes the passenger's cash at the desk and keeps it until the
    // mutual settlement: the reconciliation must count it against the agent.
    const accForCash = await login("accountant@asolbus.local", "Accountant12345");
    const agentRow = async () => {
      const r = await fetch(`${BASE_URL}/api/finance/reconciliation`, { headers: { Cookie: accForCash } });
      return (await r.json()).agents?.find((a) => a.name.includes("agent@asolbus.local"));
    };
    const before = await agentRow();
    const seatsAgain = await (await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(trip.id)}/seats`)).json();
    const agentSeat = (seatsAgain.layout?.decks ?? [])
      .flatMap((d) => d.rows.flat())
      .map((cell) => cell.seat)
      .find((seat) => seat && seat.status === "AVAILABLE" && seat.mult === 1);
    const agentBooking = await fetch(`${BASE_URL}/api/booking`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: agentCookie },
      body: JSON.stringify({
        ...bookingPayload,
        promoCode: undefined,
        seatNumber: agentSeat?.number ?? null,
        passenger: { name: "Cash Passenger", phone: "+380991112244", ageCategory: "ADULT" },
      }),
    });
    const agentBookingBody = await agentBooking.json();
    check("agent books a ticket for a walk-in passenger", agentBooking.status === 201, `got ${agentBooking.status}: ${JSON.stringify(agentBookingBody).slice(0, 160)}`);
    const agentRef = agentBookingBody.booking?.reference;
    const agentDetail = await (await fetch(`${BASE_URL}/api/booking?reference=${agentRef}`, { headers: { Cookie: agentCookie } })).json();
    const agentTicket = agentDetail.booking?.ticket;
    const paidCash = await fetch(`${BASE_URL}/api/account/tickets/${agentTicket?.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: agentCookie },
      body: JSON.stringify({ status: "PAID_CASH" }),
    });
    const paidCashBody = await paidCash.json();
    check(
      "agent marks it paid in cash — the agent is recorded as holding the cash",
      paidCash.status === 200 && paidCashBody.ticket?.cashCollectedById != null,
      `got ${paidCash.status}: ${JSON.stringify(paidCashBody).slice(0, 160)}`
    );
    const badCollector = await fetch(`${BASE_URL}/api/account/tickets/${agentTicket?.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: agentCookie },
      body: JSON.stringify({ status: "PAID_CASH", cashCollector: "BANK" }),
    });
    check("unknown cashCollector is rejected (400)", badCollector.status === 400, `got ${badCollector.status}`);
    const after = await agentRow();
    const price = agentTicket?.finalPrice ?? 0;
    check(
      "reconciliation: agent's cash on hand grows by the ticket price, balance moves in our favour",
      before && after && Math.abs(after.cashHeld - before.cashHeld - price) < 0.01 && after.debt < before.debt,
      `before ${before?.cashHeld}/${before?.debt}, after ${after?.cashHeld}/${after?.debt}, price ${price}`
    );
  }

  const accountantCookie = await login("accountant@asolbus.local", "Accountant12345");
  check("seeded accountant can log in", Boolean(accountantCookie));
  if (accountantCookie) {
    const accSettlements = await fetch(`${BASE_URL}/api/finance/settlements`, { headers: { Cookie: accountantCookie } });
    check("GET /api/finance/settlements as ACCOUNTANT returns 200", accSettlements.status === 200, `got ${accSettlements.status}`);
    const accCsv = await fetch(`${BASE_URL}/api/finance/carrier-report/csv`, { headers: { Cookie: accountantCookie } });
    // Read raw bytes: Response.text() silently strips a UTF-8 BOM.
    const csvBytes = Buffer.from(await accCsv.arrayBuffer());
    check(
      "carrier report CSV downloads for ACCOUNTANT (BOM + ; header)",
      accCsv.status === 200 &&
        csvBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) &&
        csvBytes.toString("utf8").includes("Номер;Пасажир"),
      `got ${accCsv.status}`
    );
    const accPage = await fetch(`${BASE_URL}/cabinet/finance`, { headers: { Cookie: accountantCookie }, redirect: "manual" });
    check("GET /cabinet/finance as ACCOUNTANT returns 200", accPage.status === 200, `got ${accPage.status}`);

    // Звірка: accrued / paid / debt per carrier and agent.
    const recon = await fetch(`${BASE_URL}/api/finance/reconciliation`, { headers: { Cookie: accountantCookie } });
    const reconBody = await recon.json();
    const demoAgent = reconBody.agents?.find((a) => a.name.includes("agent@asolbus.local"));
    check(
      "reconciliation lists carriers and the seeded agent with accrued/paid/debt",
      recon.status === 200 && Array.isArray(reconBody.carriers) && demoAgent &&
        typeof demoAgent.accrued === "number" && typeof demoAgent.paid === "number" &&
        Math.abs(demoAgent.accrued - demoAgent.paid - demoAgent.debt) < 0.01,
      `got ${recon.status}`
    );
    const badPayment = await fetch(`${BASE_URL}/api/finance/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: accountantCookie },
      body: JSON.stringify({ kind: "AGENT", counterpartyId: demoAgent?.id, direction: "OUTGOING", amount: -5, paidAt: "2026-09-01" }),
    });
    check("POST /api/finance/payments rejects a negative amount (400)", badPayment.status === 400, `got ${badPayment.status}`);
    const reconCsv = await fetch(`${BASE_URL}/api/finance/reconciliation/csv`, { headers: { Cookie: accountantCookie } });
    const reconBytes = Buffer.from(await reconCsv.arrayBuffer());
    check(
      "reconciliation CSV downloads (BOM + header)",
      reconCsv.status === 200 && reconBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) &&
        reconBytes.toString("utf8").includes("Нараховано, EUR;Виплачено, EUR;Борг, EUR"),
      `got ${reconCsv.status}`
    );

    // Автозвіти ship switched off.
    const auto = await fetch(`${BASE_URL}/api/finance/auto-reports`, { headers: { Cookie: accountantCookie } });
    const autoBody = await auto.json();
    check("auto-reports are off by default and list carriers + agents", auto.status === 200 && autoBody.enabled === false && autoBody.carriers?.length > 0 && autoBody.agents?.length > 0, `got ${auto.status}`);
    const badDay = await fetch(`${BASE_URL}/api/finance/auto-reports`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: accountantCookie },
      body: JSON.stringify({ rows: [{ kind: "CARRIER", id: autoBody.carriers?.[0]?.id, enabled: true, sendDay: 31 }] }),
    });
    check("PUT auto-reports rejects day 31 (400)", badDay.status === 400, `got ${badDay.status}`);
  }

  // --- Cancellation (owner may cancel a RESERVED ticket) ----------------------
  const cancelNoAuth = await fetch(ticketApi(ownTicketId, "status"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  check("PATCH status without auth returns 401", cancelNoAuth.status === 401, `got ${cancelNoAuth.status}`);

  const cancelMissing = await fetch(ticketApi("nonexistent-id", "status"), {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  check("cancelling a non-existent ticket returns 404", cancelMissing.status === 404, `got ${cancelMissing.status}`);

  const cancelOwn = await fetch(ticketApi(ownTicketId, "status"), {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ status: "CANCELLED" }),
  });
  check("owner can cancel own reserved ticket", cancelOwn.status === 200, `got ${cancelOwn.status}`);

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
