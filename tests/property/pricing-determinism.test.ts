import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { evaluatePricingV1, type PricingRule } from "../../src/modules/pricing/domain/evaluator-v1";

const ruleArbitrary = fc.record({
  priority: fc.integer({ min: 1, max: 50 }),
  amountMinor: fc.integer({ min: 0, max: 100_000 }),
  percentBasisPoints: fc.option(fc.integer({ min: -1_000, max: 1_000 }), { nil: undefined })
});

describe("pricing determinism", () => {
  it("is invariant to answer key insertion order and rule insertion order", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000 }),
        fc.array(ruleArbitrary, { minLength: 0, maxLength: 12 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (basePriceMinor, generatedRules, pages, seats) => {
          const rules: PricingRule[] = generatedRules.map((rule, index) => ({
            id: `addon_${index}`,
            label: `Add-on ${index}`,
            kind: "ADDON",
            priority: rule.priority,
            amountMinor: rule.amountMinor,
            ...(rule.percentBasisPoints === undefined
              ? {}
              : { percentBasisPoints: rule.percentBasisPoints })
          }));
          const normal = evaluatePricingV1({
            basePriceMinor,
            answers: { pages, seats },
            selectedAddons: rules.map((rule) => rule.id),
            rules
          });
          const reordered = evaluatePricingV1({
            basePriceMinor,
            answers: { seats, pages },
            selectedAddons: [...rules].reverse().map((rule) => rule.id),
            rules: [...rules].reverse()
          });
          expect(reordered).toEqual(normal);
        }
      ),
      { numRuns: 200 }
    );
  });
});
