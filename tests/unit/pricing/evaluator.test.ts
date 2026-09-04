import { describe, expect, it } from "vitest";
import { evaluatePricingV1 } from "../../../src/modules/pricing/domain/evaluator-v1";
import type { PricingInput } from "../../../src/modules/pricing/domain/evaluator-v1";
import golden from "../../fixtures/pricing-golden.json";

describe("evaluatePricingV1", () => {
  it("applies ordered rules and rounds each percentage line item", () => {
    const result = evaluatePricingV1({
      basePriceMinor: 101,
      answers: { pages: 2, rush: true },
      selectedAddons: ["analytics"],
      rules: [
        {
          id: "rush",
          label: "Rush",
          kind: "CONDITIONAL",
          priority: 3,
          percentBasisPoints: 5000,
          field: "rush",
          equals: true
        },
        {
          id: "pages",
          label: "Pages",
          kind: "QUANTITY",
          priority: 1,
          amountMinor: 10,
          quantityField: "pages"
        },
        { id: "analytics", label: "Analytics", kind: "ADDON", priority: 2, amountMinor: 7 }
      ]
    });
    expect(result.lineItems.map((item) => item.ruleId)).toEqual([
      "base",
      "pages",
      "analytics",
      "rush"
    ]);
    expect(result.lineItems.at(-1)?.amountMinor).toBe(64);
    expect(result.totalMinor).toBe(192);
  });
});

describe("pricing golden cases", () => {
  it.each(golden)("reconciles $name", ({ input, totalMinor }) => {
    const result = evaluatePricingV1(input as unknown as PricingInput);
    expect(result.totalMinor).toBe(totalMinor);
    expect(result.totalMinor).toBe(
      result.lineItems.reduce((sum, line) => sum + line.amountMinor, 0)
    );
  });
});
