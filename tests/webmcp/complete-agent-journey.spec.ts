import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverServices } from "../../src/webmcp/adapters/discover-services";
import { createScope } from "../../src/webmcp/adapters/create-scope";
import { updateScope } from "../../src/webmcp/adapters/update-scope";
import { priceScope } from "../../src/webmcp/adapters/price-scope";
import { findConsultationSlots } from "../../src/webmcp/adapters/find-consultation-slots";
import { finalizeConfirmedScope } from "../../src/webmcp/adapters/finalize-confirmed-scope";
import { capabilityRegistry } from "../../src/webmcp/registry";

type Journey = {
  id: string;
  capability: (typeof capabilityRegistry)[number]["name"];
  outcome: string;
};

describe("complete WebMCP journey", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the 20 required capability and recovery scenarios version controlled", async () => {
    const journeys = JSON.parse(
      await readFile(new URL("../fixtures/agent-journeys.json", import.meta.url), "utf8")
    ) as Journey[];
    expect(journeys).toHaveLength(20);
    expect(new Set(journeys.map((journey) => journey.id)).size).toBe(20);
    expect(new Set(journeys.map((journey) => journey.capability))).toEqual(
      new Set(capabilityRegistry.map((capability) => capability.name))
    );
    expect(journeys.some((journey) => journey.capability.includes("confirmation"))).toBe(false);
  });

  it("runs discovery through a confirmed, idempotent finalization without an agent confirmation tool", async () => {
    let revision = 1;
    let humanConfirmed = false;
    let lead: { leadId: string; finalizedAt: string } | undefined;
    const sideEffects: string[] = [];
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      const capability = headers.get("x-clientweave-capability");
      if (url.startsWith("/api/v1/services?"))
        return new Response(JSON.stringify({ services: [{ slug: "website-launch" }] }), {
          headers: { "content-type": "application/json" }
        });
      if (url === "/api/v1/scopes")
        return new Response(JSON.stringify({ ref: "scope-agent", revision }), {
          status: 201,
          headers: { "content-type": "application/json" }
        });
      if (url === "/api/v1/scopes/current") {
        expect(headers.get("if-match")).toBe(`"${revision}"`);
        revision += 1;
        return new Response(JSON.stringify({ revision, goalActor: "AGENT" }), {
          headers: { "content-type": "application/json" }
        });
      }
      if (url === "/api/v1/scopes/current/quotes")
        return new Response(
          JSON.stringify({
            status: "CURRENT",
            eligible: true,
            minimumTotalMinor: 200000,
            maximumTotalMinor: 200000,
            lineItems: [],
            assumptions: [],
            issues: [],
            calculatedAt: "2026-09-03T00:00:00.000Z"
          }),
          { headers: { "content-type": "application/json" } }
        );
      if (url.startsWith("/api/v1/scopes/current/availability")) {
        expect(init?.method).toBeUndefined();
        return new Response(JSON.stringify({ timezone: "UTC", slots: [{ id: "slot-1" }] }), {
          headers: { "content-type": "application/json" }
        });
      }
      expect(url).toBe("/api/v1/scopes/current/finalizations");
      expect(capability).toBe("finalize_confirmed_scope");
      if (!humanConfirmed)
        return new Response(JSON.stringify({ code: "HUMAN_CONFIRMATION_REQUIRED" }), {
          status: 403,
          headers: { "content-type": "application/json" }
        });
      if (!lead) {
        lead = { leadId: "lead-agent", finalizedAt: "2026-09-03T00:00:00.000Z" };
        sideEffects.push("lead-created");
      }
      return new Response(JSON.stringify(lead), {
        status: sideEffects.length === 1 ? 201 : 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetch);

    await expect(discoverServices({ need: "Launch a website" })).resolves.toMatchObject({
      services: [{ slug: "website-launch" }]
    });
    await expect(
      createScope({ serviceSlug: "website-launch", goal: "Launch a website" })
    ).resolves.toMatchObject({
      ref: "scope-agent"
    });
    await expect(
      updateScope({ expectedRevision: 1, answers: { pages: 6 } })
    ).resolves.toMatchObject({
      revision: 2,
      goalActor: "AGENT"
    });
    await expect(priceScope(2)).resolves.toMatchObject({ status: "CURRENT", eligible: true });
    await expect(findConsultationSlots()).resolves.toMatchObject({ slots: [{ id: "slot-1" }] });

    const finalization = {
      summaryHash: "a".repeat(64),
      nonce: "00000000-0000-4000-8000-000000000003",
      contact: { email: "buyer@example.test" },
      action: "SUBMIT_LEAD_AND_BOOK" as const,
      slotId: "slot-1",
      idempotencyKey: "agent-journey"
    };
    await expect(finalizeConfirmedScope(finalization)).rejects.toMatchObject({
      code: "HUMAN_CONFIRMATION_REQUIRED"
    });
    expect(sideEffects).toEqual([]);

    // The ordinary-page direct confirmation occurs outside the six agent tools.
    humanConfirmed = true;
    const [first, retry] = await Promise.all([
      finalizeConfirmedScope(finalization),
      finalizeConfirmedScope(finalization)
    ]);
    expect(first).toEqual(retry);
    expect(sideEffects).toEqual(["lead-created"]);
  });
});
