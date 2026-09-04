import { describe, expect, it } from "vitest";
import {
  classifyPatchImpact,
  validateScopePatch
} from "../../../src/modules/scope/domain/scope-patch";

describe("scope patch", () => {
  it("accepts only allowlisted bounded data and classifies quote impact", () => {
    const patch = validateScopePatch({ answers: { pages: 4 } });
    expect(classifyPatchImpact(patch, new Set(["pages"]))).toEqual({
      general: true,
      pricing: true,
      finalization: true
    });
    expect(() => validateScopePatch({ total: 1 })).toThrow("Unsupported");
  });

  it("separates general mutations from price-affecting answer mutations", () => {
    expect(classifyPatchImpact({ goal: "Clarify the project goal" }, new Set(["pages"]))).toEqual({
      general: true,
      pricing: false,
      finalization: true
    });
    expect(classifyPatchImpact({ answers: { tone: "warm" } }, new Set(["pages"]))).toEqual({
      general: true,
      pricing: false,
      finalization: true
    });
    expect(classifyPatchImpact({ answers: { pages: 6 } }, new Set(["pages"]))).toEqual({
      general: true,
      pricing: true,
      finalization: true
    });
    expect(classifyPatchImpact({ budgetMaxMinor: 50000 }, new Set())).toEqual({
      general: true,
      pricing: true,
      finalization: true
    });
  });

  it("rejects unknown, oversized, and non-typed answer values before persistence", () => {
    for (const answers of [
      { "invalid-key": "value" },
      { pages: { nested: true } },
      { pages: "x".repeat(4001) },
      { pages: Array.from({ length: 21 }, () => "value") },
      { pages: Number.NaN }
    ])
      expect(() => validateScopePatch({ answers })).toThrow(
        "Answers must use bounded typed values and stable field keys"
      );
    expect(
      validateScopePatch({ answers: { pages: 4, addons: ["audit"], approved: true } })
    ).toEqual({
      answers: { pages: 4, addons: ["audit"], approved: true }
    });
  });
});
