import { describe, expect, it } from "vitest";
import { ScopeBroadcast } from "../../../src/server/realtime/scope-broadcast";

describe("ScopeBroadcast", () => {
  it("delivers content-free invalidations only to the authorized scope", () => {
    const events: unknown[] = [];
    const broadcast = new ScopeBroadcast();
    broadcast.subscribe(
      { scopeId: "scope-a", expiresAt: new Date("2030-01-01"), revokedAt: null },
      (event) => events.push(event)
    );
    broadcast.publish({ scopeId: "scope-b", revision: 1, changedAt: "2026-01-01T00:00:00.000Z" });
    broadcast.publish({ scopeId: "scope-a", revision: 2, changedAt: "2026-01-01T00:00:00.000Z" });
    expect(events).toEqual([
      { scopeId: "scope-a", revision: 2, changedAt: "2026-01-01T00:00:00.000Z" }
    ]);
  });
});
