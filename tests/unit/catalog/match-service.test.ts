import { describe, expect, it } from "vitest";
import { matchServices } from "../../../src/modules/catalog/domain/match-service";

describe("matchServices", () => {
  it("ranks active services by eligibility, overlap, then slug", () => {
    const matches = matchServices(
      [
        {
          slug: "zeta-site",
          name: "Zeta Website",
          description: "Design website",
          active: true,
          basePriceMinor: 100,
          deliveryMinDays: 5,
          deliveryMaxDays: 10,
          includedItems: ["design"]
        },
        {
          slug: "alpha-site",
          name: "Alpha Website",
          description: "Design website",
          active: true,
          basePriceMinor: 100,
          deliveryMinDays: 5,
          deliveryMaxDays: 10,
          includedItems: ["design"]
        },
        {
          slug: "inactive",
          name: "Website",
          description: "Design",
          active: false,
          basePriceMinor: 1,
          deliveryMinDays: 1,
          deliveryMaxDays: 2,
          includedItems: []
        }
      ],
      { need: "website design", budgetMaxMinor: 100, today: new Date("2026-01-01T00:00:00Z") }
    );
    expect(matches.map((match) => match.slug)).toEqual(["alpha-site", "zeta-site"]);
    expect(matches.every((match) => match.eligible)).toBe(true);
  });
});
