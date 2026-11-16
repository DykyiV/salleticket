import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { applyDepartureBulk } from "@/lib/routes/applyBulk";

const MARK = "bulk-phones-test";

/** Only what this test made: other tests and the seed keep their routes. */
async function clean() {
  const templates = await prisma.routeTemplate.findMany({ where: { comment: MARK }, select: { id: true, countryId: true } });
  await prisma.departure.deleteMany({ where: { templateId: { in: templates.map((t) => t.id) } } });
  await prisma.routeTemplate.deleteMany({ where: { comment: MARK } });
  await prisma.country.deleteMany({ where: { id: { in: templates.map((t) => t.countryId) } } });
}

async function departures(n: number) {
  const country = await prisma.country.create({ data: { name: `Німеччина ${Math.random()}` } });
  const template = await prisma.routeTemplate.create({
    data: { name: "Херсон — Аахен", originCity: "Херсон", destinationCity: "Аахен", countryId: country.id, comment: MARK },
  });
  return Promise.all(
    Array.from({ length: n }, (_, i) =>
      prisma.departure.create({
        data: { templateId: template.id, date: new Date(Date.UTC(2030, 0, 1 + i)), weekday: 1, busPhone: "+380000000001", dispatcherPhone: "+380000000002" },
      }),
    ),
  );
}

describe("bulk: phones of our departures", () => {
  afterEach(clean);

  it("sets the bus and / or dispatcher phone of the chosen departures only", async () => {
    const [a, b, c] = await departures(3);
    expect(await applyDepartureBulk({ departureIds: [a.id, b.id], action: "setPhones", busPhone: " +380671112233 " })).toEqual({
      updatedDepartures: 2,
      updatedStops: 0,
    });
    const after = await prisma.departure.findMany({ where: { id: { in: [a.id, b.id, c.id] } }, orderBy: { date: "asc" } });
    expect(after.map((d) => [d.busPhone, d.dispatcherPhone])).toEqual([
      ["+380671112233", "+380000000002"],
      ["+380671112233", "+380000000002"],
      ["+380000000001", "+380000000002"],
    ]);
    expect(c.id).toBe(after[2].id);
  });

  it("needs a phone", async () => {
    const [a] = await departures(1);
    await expect(applyDepartureBulk({ departureIds: [a.id], action: "setPhones", busPhone: " " })).rejects.toThrow(/телефон/);
  });
});
