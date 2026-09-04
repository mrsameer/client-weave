import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseRateLimiter } from "../../src/server/rate-limit/public-rate-limit";

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.runIf(Boolean(databaseUrl))("database-backed public rate limits", () => {
  const client = postgres(databaseUrl!, { max: 5, prepare: false });
  const limiter = new DatabaseRateLimiter(client);
  const key = {
    route: "/api/v1/scopes/current/finalizations",
    visitor: "198.51.100.10",
    scopeId: "scope-rate-test",
    operation: "finalize_confirmed_scope"
  };

  beforeEach(async () => {
    await client.unsafe("TRUNCATE public_rate_limits");
  });

  afterAll(async () => client.end({ timeout: 5 }));

  it("enforces a shared scope-and-operation limit atomically", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => limiter.consume(key, 5, 60))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(7);
    expect(results.at(-1)).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("does not conflate different scope or operation quotas", async () => {
    await limiter.consume(key, 1, 60);
    expect((await limiter.consume(key, 1, 60)).allowed).toBe(false);
    expect(
      (
        await limiter.consume(
          { ...key, scopeId: "another-scope", operation: "human_confirmation" },
          1,
          60
        )
      ).allowed
    ).toBe(true);
  });
});
