import { describe, expect, it } from "vitest";
import { assertCapabilityRegistry, capabilityRegistry } from "../../../src/webmcp/registry";

describe("WebMCP registry", () => {
  it("has exactly six capabilities and no human-confirmation operation", () => {
    expect(capabilityRegistry).toHaveLength(6);
    expect(capabilityRegistry.map((capability) => capability.name)).not.toContain(
      "human_confirmation"
    );
    expect(() => assertCapabilityRegistry()).not.toThrow();
  });

  it("rejects an incorrect state-effect or confirmation boundary", () => {
    expect(() =>
      assertCapabilityRegistry([
        ...capabilityRegistry.slice(0, 5),
        {
          name: "finalize_confirmed_scope",
          stateEffect: "READ_ONLY",
          requiresHumanConfirmation: false
        }
      ])
    ).toThrow("Invalid state effect");
  });
});
