import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as findAvailability } from "../../src/app/api/v1/scopes/current/availability/route";
import { POST as finalizeScope } from "../../src/app/api/v1/scopes/current/finalizations/route";
import { createFinalSummary } from "../../src/modules/finalization/domain/final-summary";

describe("availability and finalization contracts", () => {
  it("keeps availability scope-bound and validates its bounded query", async () => {
    const unavailable = await findAvailability(
      new NextRequest("http://clientweave.test/api/v1/scopes/current/availability")
    );
    expect(unavailable.status).toBe(404);
    expect((await unavailable.json()).code).toBe("SCOPE_UNAVAILABLE");

    const invalid = await findAvailability(
      new NextRequest("http://clientweave.test/api/v1/scopes/current/availability?limit=31", {
        headers: { cookie: "__Host-clientweave_scope=session-token" }
      })
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).code).toBe("VALIDATION_ERROR");
  });

  it("requires an idempotency key before a finalization can reach storage", async () => {
    const response = await finalizeScope(
      new NextRequest("http://clientweave.test/api/v1/scopes/current/finalizations", {
        method: "POST",
        headers: {
          cookie: "__Host-clientweave_scope=session-token; clientweave_csrf=csrf-token",
          "x-csrf-token": "csrf-token"
        },
        body: JSON.stringify({})
      })
    );
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("IDEMPOTENCY_REQUIRED");
  });

  it("binds the complete attributed scope and current quote line items into the reviewed summary", () => {
    const summary = createFinalSummary(
      {
        scopeRevision: 3,
        quoteId: "quote-1",
        quoteTotalMinor: 12_500,
        contact: { email: "buyer@example.test" },
        action: "SUBMIT_LEAD",
        nonce: "00000000-0000-4000-8000-000000000001",
        retentionNotice: "Retained for 365 days",
        scopeSnapshot: {
          goal: "Launch website",
          goalActor: "AGENT",
          answers: { pages: { value: 5, actor: "HUMAN" } }
        },
        quoteSnapshot: { lineItems: [{ label: "Base", amountMinor: 12_500 }] },
        serviceConstraints: [{ kind: "MAX_DELIVERY_DAYS", days: 21 }]
      },
      new Date("2026-09-03T00:00:00Z")
    );
    expect(summary).toMatchObject({
      scopeRevision: 3,
      scopeSnapshot: expect.objectContaining({ goalActor: "AGENT" }),
      quoteSnapshot: { lineItems: [{ label: "Base", amountMinor: 12_500 }] },
      serviceConstraints: [{ kind: "MAX_DELIVERY_DAYS", days: 21 }]
    });
    expect(summary.expiresAt).toEqual(new Date("2026-09-03T00:10:00Z"));
  });
});
