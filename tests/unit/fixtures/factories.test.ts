import { describe, expect, it } from "vitest";
import { entityId, fixedClock, resetFactorySequence } from "../../fixtures/factories";

describe("fixtures", () => {
  it("are deterministic after reset", () => {
    resetFactorySequence();
    expect(entityId("scope")).toBe("scope-0001");
    expect(fixedClock().now().toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
});
