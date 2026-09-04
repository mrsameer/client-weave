import { describe, expect, it } from "vitest";
import { discoverServices } from "../../../src/modules/catalog/application/discover-services";

describe("discoverServices", () => {
  it("delegates only to active catalog reads and preserves deterministic matching", async () => {
    const result = await discoverServices(
      {
        listActive: async () => [
          {
            slug: "site",
            name: "Website",
            description: "Website design",
            active: true,
            basePriceMinor: 100,
            deliveryMinDays: 2,
            deliveryMaxDays: 5,
            includedItems: ["design"]
          }
        ]
      },
      "workspace",
      { need: "website" }
    );
    expect(result).toMatchObject([{ slug: "site", eligible: true }]);
  });
});
