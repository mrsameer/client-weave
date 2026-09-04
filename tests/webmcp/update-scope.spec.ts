import { afterEach, describe, expect, it, vi } from "vitest";
import { updateScope } from "../../src/webmcp/adapters/update-scope";
import { classifyPatchImpact } from "../../src/modules/scope/domain/scope-patch";

describe("WebMCP shared scope updates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("translates expected_revision into canonical If-Match and identifies the agent capability", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ revision: 3, goalActor: "AGENT" }), {
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetch);
    await updateScope({
      expectedRevision: 2,
      goal: "Apply the buyer-approved tradeoff",
      budgetMaxMinor: 15_000,
      answers: { pages: 4 }
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/scopes/current");
    expect(init.method).toBe("PATCH");
    const headers = new Headers(init.headers);
    expect(headers.get("if-match")).toBe('"2"');
    expect(headers.get("x-clientweave-capability")).toBe("update_scope");
    expect(init.body).toContain("buyer-approved tradeoff");
  });

  it("classifies human corrections and agent tradeoffs against one shared revision model", () => {
    const priceFields = new Set(["pages", "budgetMaxMinor"]);
    expect(classifyPatchImpact({ goal: "Human correction" }, priceFields)).toEqual({
      general: true,
      pricing: false,
      finalization: true
    });
    expect(classifyPatchImpact({ answers: { pages: 4 } }, priceFields)).toEqual({
      general: true,
      pricing: true,
      finalization: true
    });
  });
});
