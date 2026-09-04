import { describe, expect, it } from "vitest";
import { sanitizeInvocationReason } from "../../src/db/repositories/agent-invocation-repository";
import { capabilityInspector } from "../../src/webmcp/inspector";
import { capabilityRegistry } from "../../src/webmcp/registry";

describe("WebMCP inspector contract", () => {
  it("returns exactly the six contracted capabilities and the four closed state effects", () => {
    const output = capabilityInspector();
    expect(output).toHaveLength(6);
    expect(output.map((capability) => capability.name).sort()).toEqual([
      "create_scope",
      "discover_services",
      "finalize_confirmed_scope",
      "find_consultation_slots",
      "price_scope",
      "update_scope"
    ]);
    expect(new Set(output.map((capability) => capability.stateEffect))).toEqual(
      new Set(["READ_ONLY", "DRAFT_MUTATION", "DERIVED_RECORD_WRITE", "CONSEQUENTIAL_WRITE"])
    );
    expect(output).toEqual(
      capabilityRegistry.map((capability) => ({ ...capability, recentInvocations: [] }))
    );
  });

  it("filters to each capability, bounds recency to five, and omits secrets and contacts", () => {
    const invocations: Array<{
      capability: string;
      outcome: "SUCCEEDED" | "REJECTED" | "FAILED";
      reason: string;
      createdAt: Date;
    }> = Array.from({ length: 7 }, (_, index) => ({
      capability: "update_scope",
      outcome: "SUCCEEDED" as const,
      reason: sanitizeInvocationReason(`email=buyer${index}@example.test token=scope-${index}`),
      createdAt: new Date(`2026-09-0${index + 1}T00:00:00Z`)
    }));
    invocations.push({
      capability: "price_scope",
      outcome: "REJECTED" as const,
      reason: "quote stale",
      createdAt: new Date("2026-09-10T00:00:00Z")
    });
    const output = capabilityInspector(invocations);
    const updateScope = output.find((capability) => capability.name === "update_scope");
    const priceScope = output.find((capability) => capability.name === "price_scope");
    expect(updateScope?.recentInvocations).toHaveLength(5);
    expect(priceScope?.recentInvocations).toEqual([
      expect.objectContaining({ outcome: "REJECTED", reason: "quote stale" })
    ]);
    expect(JSON.stringify(output)).not.toMatch(/buyer\d+@example|scope-\d+/);
  });
});
