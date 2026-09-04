import { describe, expect, it, vi } from "vitest";
import { priceScope } from "../../../src/modules/pricing/application/price-scope";

describe("priceScope", () => {
  it("persists only its server-derived deterministic evaluation", async () => {
    let stored: { totalMinor: number; inputHash: string } | undefined;
    let audit: { workspaceId: string; scopeRevision: number; ruleSetId: string } | undefined;
    const result = await priceScope(
      {
        persist: async (quote) => {
          stored = quote;
          return quote;
        },
        appendPriceAudit: async (input) => {
          audit = input;
        }
      },
      {
        scopeId: "scope",
        scopeRevision: 1,
        ruleSetId: "rules",
        evaluatorVersion: "v1",
        workspaceId: "workspace",
        basePriceMinor: 100,
        answers: {},
        rules: []
      }
    );
    expect(result).toMatchObject({ status: "CURRENT", eligible: true, totalMinor: 100 });
    expect(stored?.totalMinor).toBe(100);
    expect(stored?.inputHash).toHaveLength(64);
    expect(audit).toMatchObject({ workspaceId: "workspace", scopeRevision: 1, ruleSetId: "rules" });
  });

  it("returns explicit incomplete or conflicted results without persisting a final price", async () => {
    const persist = vi.fn();
    const result = await priceScope(
      { persist },
      {
        scopeId: "scope",
        scopeRevision: 1,
        ruleSetId: "rules",
        evaluatorVersion: "v1",
        basePriceMinor: 100,
        answers: {},
        rules: [],
        issues: [
          { code: "REQUIRED", field: "pages", message: "pages is required.", severity: "MISSING" }
        ]
      }
    );
    expect(result).toMatchObject({ status: "INCOMPLETE", eligible: false, lineItems: [] });
    expect(persist).not.toHaveBeenCalled();
  });
});
