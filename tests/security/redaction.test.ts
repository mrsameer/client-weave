import { describe, expect, it } from "vitest";
import { sanitizeInvocationReason } from "../../src/db/repositories/agent-invocation-repository";
import { capabilityInspector } from "../../src/webmcp/inspector";
import { capabilityRegistry } from "../../src/webmcp/registry";
import { problemResponse } from "../../src/contracts/problems/to-problem-response";
import { ScopeBroadcast } from "../../src/server/realtime/scope-broadcast";

describe("redaction boundaries", () => {
  it("removes contacts and credential-like values from persisted invocation reasons", () => {
    expect(
      sanitizeInvocationReason(
        "failed for buyer@example.test token=scope-secret authorization: Bearer credential"
      )
    ).not.toMatch(/buyer@example|scope-secret|credential/);
  });

  it("keeps the inspector to contracted metadata and sanitized invocation fields", () => {
    const output = capabilityInspector([
      {
        capability: "update_scope",
        outcome: "REJECTED",
        reason: sanitizeInvocationReason("cookie=session-secret"),
        createdAt: new Date("2026-01-01T00:00:00Z")
      }
    ]);
    expect(output).toHaveLength(6);
    expect(output.map((capability) => capability.name).sort()).toEqual(
      capabilityRegistry.map((capability) => capability.name).sort()
    );
    expect(JSON.stringify(output)).not.toMatch(/session-secret/);
  });

  it("redacts public problem details instead of reflecting contacts or credentials", async () => {
    const response = problemResponse(
      400,
      "VALIDATION_ERROR",
      "token=scope-secret",
      "Cannot use buyer@example.test authorization: Bearer credential"
    );
    const body = JSON.stringify(await response.json());
    expect(body).not.toMatch(/scope-secret|buyer@example|credential/);
    expect(body).toMatch(/\[redacted\]/);
  });

  it("publishes only the minimal revision invalidation envelope", () => {
    const broadcast = new ScopeBroadcast();
    const events: unknown[] = [];
    const stop = broadcast.subscribe(
      { scopeId: "scope-a", expiresAt: new Date(Date.now() + 60_000), revokedAt: null },
      (event) => {
        events.push(event);
      }
    );
    broadcast.publish({ scopeId: "scope-a", revision: 2, changedAt: "2026-09-03T00:00:00Z" });
    stop();
    expect(events).toEqual([
      { scopeId: "scope-a", revision: 2, changedAt: "2026-09-03T00:00:00Z" }
    ]);
    expect(JSON.stringify(events)).not.toMatch(/email|contact|answer|secret/i);
  });
});
