import { afterEach, describe, expect, it, vi } from "vitest";
import { capabilityRegistry } from "../../src/webmcp/registry";
import { finalizeConfirmedScope } from "../../src/webmcp/adapters/finalize-confirmed-scope";
import { findConsultationSlots } from "../../src/webmcp/adapters/find-consultation-slots";

describe("WebMCP finalization boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exposes no confirmation capability and only marks finalization as consequential", () => {
    expect(capabilityRegistry.map((capability) => capability.name)).not.toContain(
      "human_confirmation"
    );
    expect(capabilityRegistry.filter((capability) => capability.requiresHumanConfirmation)).toEqual(
      [
        expect.objectContaining({
          name: "finalize_confirmed_scope",
          stateEffect: "CONSEQUENTIAL_WRITE"
        })
      ]
    );
  });

  it("sends finalization through the contracted endpoint without creating a confirmation operation", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ leadId: "lead", finalizedAt: "2026-01-01T00:00:00.000Z" }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetch);
    await finalizeConfirmedScope({
      summaryHash: "a".repeat(64),
      nonce: "00000000-0000-4000-8000-000000000001",
      contact: { email: "buyer@example.test" },
      action: "SUBMIT_LEAD",
      idempotencyKey: "retry-key"
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/scopes/current/finalizations",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers)
      })
    );
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("x-clientweave-capability")).toBe(
      "finalize_confirmed_scope"
    );
    expect(init.body).toContain("nonce");
  });

  it("keeps availability read-only and only finalizes once after a server-held human receipt", async () => {
    let humanReceiptRecorded = false;
    const finalized = new Map<string, { leadId: string; finalizedAt: string }>();
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      if (url.startsWith("/api/v1/scopes/current/availability")) {
        expect(init?.method).toBeUndefined();
        expect(headers.get("x-clientweave-capability")).toBe("find_consultation_slots");
        return new Response(JSON.stringify({ timezone: "UTC", slots: [{ id: "slot-1" }] }), {
          headers: { "content-type": "application/json" }
        });
      }
      expect(url).toBe("/api/v1/scopes/current/finalizations");
      expect(headers.get("x-clientweave-capability")).toBe("finalize_confirmed_scope");
      if (!humanReceiptRecorded)
        return new Response(
          JSON.stringify({
            code: "HUMAN_CONFIRMATION_REQUIRED",
            detail: "Review and confirm first."
          }),
          { status: 403, headers: { "content-type": "application/json" } }
        );
      const idempotencyKey = headers.get("idempotency-key")!;
      const result = finalized.get(idempotencyKey) ?? {
        leadId: "lead-1",
        finalizedAt: "2026-01-01T00:00:00.000Z"
      };
      finalized.set(idempotencyKey, result);
      return new Response(JSON.stringify(result), {
        status: finalized.size === 1 ? 201 : 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetch);

    await expect(findConsultationSlots()).resolves.toEqual({
      timezone: "UTC",
      slots: [{ id: "slot-1" }]
    });
    const request = {
      summaryHash: "b".repeat(64),
      nonce: "00000000-0000-4000-8000-000000000002",
      contact: { email: "buyer@example.test" },
      action: "SUBMIT_LEAD" as const,
      idempotencyKey: "confirmed-retry"
    };
    await expect(finalizeConfirmedScope(request)).rejects.toMatchObject({
      status: 403,
      code: "HUMAN_CONFIRMATION_REQUIRED"
    });
    expect(finalized).toHaveLength(0);

    // This represents the direct ordinary-page human-confirmation flow. It is
    // deliberately not an agent capability or adapter invocation.
    humanReceiptRecorded = true;
    const [first, retry] = await Promise.all([
      finalizeConfirmedScope(request),
      finalizeConfirmedScope(request)
    ]);
    expect(first).toEqual(retry);
    expect(finalized).toHaveLength(1);
  });
});
