import { describe, expect, it } from "vitest";
import {
  toMutation,
  updateScope,
  type ScopeMutator
} from "../../../src/modules/scope/application/update-scope";
import {
  classifyPatchImpact,
  validateScopePatch
} from "../../../src/modules/scope/domain/scope-patch";

describe("shared scope mutation use case", () => {
  it("normalizes a complete attributed patch and delegates one optimistic mutation", async () => {
    const calls: Parameters<ScopeMutator["update"]>[] = [];
    const mutator: ScopeMutator = {
      async update(...args) {
        calls.push(args);
        return null;
      }
    };
    await updateScope(mutator, {
      scopeId: "scope-1",
      expectedRevision: 7,
      actor: "AGENT",
      patch: {
        goal: "Refine the launch scope",
        budgetMaxMinor: null,
        targetDeliveryDate: "2026-10-01",
        assumptions: ["Buyer supplies copy"],
        answers: { pages: 5, addons: ["analytics"] }
      }
    });
    expect(calls).toEqual([
      [
        "scope-1",
        {
          goal: "Refine the launch scope",
          budgetMaxMinor: null,
          targetDeliveryDate: new Date("2026-10-01T00:00:00.000Z"),
          assumptions: ["Buyer supplies copy"],
          answers: { pages: 5, addons: ["analytics"] },
          expectedRevision: 7,
          actor: "AGENT"
        }
      ]
    ]);
  });

  it("does not allow a caller to smuggle unsupported fields or actors", async () => {
    const mutator: ScopeMutator = {
      async update() {
        return null;
      }
    };
    await expect(
      updateScope(mutator, {
        scopeId: "scope-1",
        expectedRevision: 1,
        actor: "HUMAN",
        patch: { totalMinor: 1 }
      })
    ).rejects.toThrow("Unsupported scope patch field");
    await expect(
      updateScope(mutator, {
        scopeId: "scope-1",
        expectedRevision: 1,
        actor: "UNTRUSTED" as unknown as "HUMAN",
        patch: { goal: "Safe goal" }
      })
    ).rejects.toThrow("Actor must be server-derived");
  });

  it("treats every accepted edit as finalization-relevant and retains pricing impact after revert", () => {
    const pricingFields = new Set(["pages"]);
    const general = classifyPatchImpact(validateScopePatch({ goal: "New goal" }), pricingFields);
    const pricing = classifyPatchImpact(
      validateScopePatch({ answers: { pages: 6 } }),
      pricingFields
    );
    const reverted = classifyPatchImpact(
      validateScopePatch({ answers: { pages: 3 } }),
      pricingFields
    );
    expect(general).toEqual({ general: true, pricing: false, finalization: true });
    expect(pricing).toEqual({ general: true, pricing: true, finalization: true });
    expect(reverted).toEqual(pricing);
  });

  it("preserves per-value actor attribution and ordered assumption replacements in mutations", () => {
    expect(
      toMutation(
        {
          assumptions: ["Keep the existing copy", "Add accessibility review"],
          answers: { pages: 5 },
          targetDeliveryDate: null
        },
        4,
        "HUMAN"
      )
    ).toEqual({
      expectedRevision: 4,
      actor: "HUMAN",
      assumptions: ["Keep the existing copy", "Add accessibility review"],
      answers: { pages: 5 },
      targetDeliveryDate: null
    });
  });

  it("returns specific mutation validation issues for empty and malformed patches", () => {
    expect(() => validateScopePatch({})).toThrow("Scope patch cannot be empty");
    expect(() => validateScopePatch({ assumptions: [""] })).toThrow(
      "Assumptions must be a bounded list"
    );
    expect(() => validateScopePatch({ answers: { pages: { value: 3 } } })).toThrow(
      "Answers must use bounded typed values"
    );
  });
});
