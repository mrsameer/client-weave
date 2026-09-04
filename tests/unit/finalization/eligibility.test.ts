import { describe, expect, it } from "vitest";
import { recordHumanConfirmation } from "../../../src/modules/finalization/application/record-human-confirmation";
import { assessFinalization } from "../../../src/modules/finalization/domain/eligibility";
import { createFinalSummary } from "../../../src/modules/finalization/domain/final-summary";

describe("finalization eligibility", () => {
  const input = {
    scopeRevision: 1,
    quoteId: "quote",
    quoteTotalMinor: 100,
    contact: { email: "buyer@example.test" },
    action: "SUBMIT_LEAD" as const,
    nonce: "00000000-0000-4000-8000-000000000001",
    retentionNotice: "Retained",
    scopeSnapshot: {},
    quoteSnapshot: {},
    serviceConstraints: []
  };
  it("requires a current human confirmation and quote", () => {
    const summary = createFinalSummary(input, new Date("2026-01-01T00:00:00Z"));
    expect(
      assessFinalization({
        quoteCurrent: true,
        summary: input,
        confirmation: summary,
        now: new Date("2026-01-01T00:01:00Z")
      })
    ).toEqual({ eligible: true });
    expect(
      assessFinalization({ quoteCurrent: false, summary: input, confirmation: summary })
    ).toEqual({ eligible: false, code: "QUOTE_STALE" });
  });
  it("does not permit agent-originated confirmation", async () => {
    await expect(
      recordHumanConfirmation({ record: async () => ({ id: "confirmation" }) }, input, "AGENT")
    ).rejects.toThrow("ordinary user interface");
  });

  it("invalidates confirmation when a canonical review value changes", () => {
    const summary = createFinalSummary(input, new Date("2026-01-01T00:00:00Z"));
    expect(
      assessFinalization({
        quoteCurrent: true,
        summary: { ...input, nonce: "00000000-0000-4000-8000-000000000002" },
        confirmation: summary,
        now: new Date("2026-01-01T00:01:00Z")
      })
    ).toEqual({ eligible: false, code: "CONFIRMATION_STALE" });
    expect(
      assessFinalization({
        quoteCurrent: true,
        summary: input,
        confirmation: null,
        now: new Date("2026-01-01T00:01:00Z")
      })
    ).toEqual({ eligible: false, code: "CONFIRMATION_REQUIRED" });
  });

  it("requires minimal contact and a slot for booking state transitions", () => {
    expect(() =>
      createFinalSummary(
        { ...input, contact: {}, action: "SUBMIT_LEAD" },
        new Date("2026-01-01T00:00:00Z")
      )
    ).toThrow("contact");
    expect(() =>
      createFinalSummary(
        { ...input, action: "SUBMIT_LEAD_AND_BOOK" },
        new Date("2026-01-01T00:00:00Z")
      )
    ).toThrow("slot");
    expect(
      assessFinalization({
        quoteCurrent: true,
        summary: { ...input, action: "SUBMIT_LEAD_AND_BOOK" },
        confirmation: null
      })
    ).toEqual({ eligible: false, code: "SLOT_REQUIRED" });
  });
});
