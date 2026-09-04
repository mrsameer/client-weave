import { describe, expect, it } from "vitest";
import {
  confirmationMatches,
  createFinalSummary
} from "../../../src/modules/finalization/domain/final-summary";

describe("final summary", () => {
  it("binds confirmation to the exact current summary", () => {
    const input = {
      scopeRevision: 1,
      quoteId: "quote",
      quoteTotalMinor: 100,
      contact: { email: "buyer@example.test" },
      action: "SUBMIT_LEAD" as const,
      nonce: "00000000-0000-4000-8000-000000000001",
      retentionNotice: "Retained for 365 days",
      scopeSnapshot: {},
      quoteSnapshot: {},
      serviceConstraints: []
    };
    const summary = createFinalSummary(input, new Date("2026-01-01T00:00:00Z"));
    expect(confirmationMatches(summary, input, new Date("2026-01-01T00:01:00Z"))).toBe(true);
    expect(
      confirmationMatches(
        summary,
        { ...input, quoteTotalMinor: 101 },
        new Date("2026-01-01T00:01:00Z")
      )
    ).toBe(false);
  });
});
