import { describe, expect, it } from "vitest";
import { canonicalHash } from "../../../src/modules/pricing/domain/canonicalize";
import { replayQuote } from "../../../src/modules/pricing/application/replay-quote";

describe("replayQuote", () => {
  it("uses the retained evaluator and immutable input hash", () => {
    const input = {
      basePriceMinor: 100,
      answers: {},
      selectedAddons: [],
      rules: [],
      evaluatorVersion: "v1" as const
    };
    expect(replayQuote({ ...input, inputHash: canonicalHash(input) }).totalMinor).toBe(100);
  });
});
