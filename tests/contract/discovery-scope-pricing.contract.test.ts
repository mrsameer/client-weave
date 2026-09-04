import { describe, expect, it } from "vitest";
import { problemDetailsSchema } from "../../src/contracts/problems/problem-details";
import { problemResponse } from "../../src/contracts/problems/to-problem-response";
import {
  createScopeRequestSchema,
  quoteResultSchema,
  scopeReviewSchema,
  serviceMatchSchema
} from "../../src/contracts/schemas";
import { matchServices } from "../../src/modules/catalog/domain/match-service";
import { priceScope } from "../../src/modules/pricing/application/price-scope";

describe("discovery, scope, and pricing contracts", () => {
  it("exposes active matches with explicit commercial configuration fields", () => {
    const publicMatch = {
      slug: "website-launch",
      name: "Website launch",
      description: "A launch-ready marketing website.",
      basePriceMinor: 10_000,
      currency: "USD",
      deliveryMinDays: 7,
      deliveryMaxDays: 14,
      includedItems: ["Discovery", "Design"],
      addons: ["Analytics"],
      intakeFields: [{ key: "pages", label: "Pages", type: "NUMBER", required: true, choices: [] }],
      constraints: ["Delivery requires approved content."],
      eligible: true,
      fitReasons: ["Base price fits the stated budget."],
      conflicts: []
    };
    expect(serviceMatchSchema.safeParse(publicMatch).success).toBe(true);
    expect(
      matchServices(
        [
          {
            slug: "inactive",
            name: "Inactive service",
            description: "Should not be returned",
            active: false,
            basePriceMinor: 1,
            deliveryMinDays: 1,
            deliveryMaxDays: 1,
            includedItems: []
          },
          { ...publicMatch, active: true }
        ],
        { need: "website design", budgetMaxMinor: 15_000, today: new Date("2026-09-01") }
      ).map((service) => service.slug)
    ).toEqual(["website-launch"]);
  });

  it("accepts null scope values and preserves attributed review records", () => {
    expect(
      createScopeRequestSchema.safeParse({
        serviceSlug: "website-launch",
        goal: "Launch a website",
        answers: { pages: null }
      }).success
    ).toBe(true);
    expect(
      scopeReviewSchema.safeParse({
        id: "00000000-0000-4000-8000-000000000001",
        ref: "a-valid-scope-reference",
        revision: 1,
        serviceSlug: "website-launch",
        goal: { value: "Launch a website", actor: "HUMAN", updatedAt: "2026-09-01T00:00:00Z" },
        budgetMaxMinor: { value: null, actor: "HUMAN", updatedAt: "2026-09-01T00:00:00Z" },
        targetDeliveryDate: { value: null, actor: "AGENT", updatedAt: "2026-09-01T00:00:00Z" },
        assumptions: [
          { value: "Buyer supplies copy", actor: "AGENT", updatedAt: "2026-09-01T00:00:00Z" }
        ],
        answers: { pages: { value: null, actor: "HUMAN", updatedAt: "2026-09-01T00:00:00Z" } },
        actor: "HUMAN",
        missingFields: [],
        conflicts: [],
        quote: null
      }).success
    ).toBe(true);
  });

  it("returns deterministic server-derived quote outputs and safe validation problems", async () => {
    const quoteInput = {
      scopeId: "scope",
      scopeRevision: 1,
      ruleSetId: "rules",
      evaluatorVersion: "v1" as const,
      basePriceMinor: 10_000,
      answers: {},
      rules: []
    };
    const writer = { persist: async (quote: object) => quote };
    const [first, second] = await Promise.all([
      priceScope(writer, quoteInput),
      priceScope(writer, quoteInput)
    ]);
    expect(first).toMatchObject({ totalMinor: 10_000, inputHash: second.inputHash });
    const publicQuote = {
      status: first.status,
      eligible: first.eligible,
      ...(first.currency === undefined ? {} : { currency: first.currency }),
      ...(first.minimumTotalMinor === undefined
        ? {}
        : { minimumTotalMinor: first.minimumTotalMinor }),
      ...(first.maximumTotalMinor === undefined
        ? {}
        : { maximumTotalMinor: first.maximumTotalMinor }),
      lineItems: first.lineItems,
      assumptions: first.assumptions,
      issues: first.issues,
      calculatedAt: first.calculatedAt,
      ...(first.pricingRuleVersion === undefined
        ? {}
        : { pricingRuleVersion: first.pricingRuleVersion })
    };
    expect(quoteResultSchema.safeParse(publicQuote).success).toBe(true);
    const problem = await problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid scope",
      "Use a valid typed value."
    ).json();
    expect(problemDetailsSchema.safeParse(problem).success).toBe(true);
  });
});
