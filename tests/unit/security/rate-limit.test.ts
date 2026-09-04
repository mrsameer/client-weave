import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "../../../src/server/rate-limit/public-rate-limit";

describe("public rate limit keys", () => {
  it("separates route, scope, and operation quotas", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000);
    expect(
      limiter.consume({ route: "/api/v1/scopes", visitor: "127.0.0.1", operation: "create_scope" })
        .allowed
    ).toBe(true);
    expect(
      limiter.consume({ route: "/api/v1/scopes", visitor: "127.0.0.1", operation: "create_scope" })
        .allowed
    ).toBe(false);
    expect(
      limiter.consume({
        route: "/api/v1/scopes/current",
        visitor: "127.0.0.1",
        scopeId: "scope-a",
        operation: "update_scope"
      }).allowed
    ).toBe(true);
  });
});
