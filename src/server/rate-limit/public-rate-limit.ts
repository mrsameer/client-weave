import postgres, { type Sql } from "postgres";
import { getEnvironment } from "@/server/env";

export type RateLimitKey = { route: string; visitor: string; scopeId?: string; operation?: string };
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

/**
 * Small deterministic limiter used by adapters; production storage supplies atomic
 * database increments to retain limits across functions and process restarts.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}
  consume(key: RateLimitKey, now = Date.now()): RateLimitResult {
    const id = [key.route, key.visitor, key.scopeId ?? "", key.operation ?? ""].join(":");
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(id) ?? []).filter((time) => time > cutoff);
    if (recent.length >= this.limit)
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((recent[0]! + this.windowMs - now) / 1000)
      };
    recent.push(now);
    this.hits.set(id, recent);
    return { allowed: true, remaining: this.limit - recent.length, retryAfterSeconds: 0 };
  }
}

/** PostgreSQL-backed limiter shared by server instances and safe under concurrent requests. */
export class DatabaseRateLimiter {
  constructor(private readonly sql: Sql) {}

  async consume(
    key: RateLimitKey,
    limit: number,
    windowSeconds: number,
    now = new Date()
  ): Promise<RateLimitResult> {
    const id = [key.route, key.visitor, key.scopeId ?? "", key.operation ?? ""].join(":");
    const [row] = await this.sql<{ request_count: number; window_started_at: Date }[]>`
      INSERT INTO public_rate_limits (key, window_started_at, request_count, updated_at)
      VALUES (${id}, ${now}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        window_started_at = CASE
          WHEN public_rate_limits.window_started_at <= ${now.toISOString()}::timestamptz - (${windowSeconds} * interval '1 second') THEN ${now}
          ELSE public_rate_limits.window_started_at
        END,
        request_count = CASE
          WHEN public_rate_limits.window_started_at <= ${now.toISOString()}::timestamptz - (${windowSeconds} * interval '1 second') THEN 1
          ELSE public_rate_limits.request_count + 1
        END,
        updated_at = ${now}
      RETURNING request_count, window_started_at`;
    if (!row) throw new Error("Rate limit write did not return a row");
    const allowed = row.request_count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - row.request_count),
      retryAfterSeconds: allowed
        ? 0
        : Math.max(
            1,
            Math.ceil(
              (row.window_started_at.getTime() + windowSeconds * 1000 - now.getTime()) / 1000
            )
          )
    };
  }
}

const globalRateLimit = globalThis as typeof globalThis & { __clientweaveRateLimitSql?: Sql };

export async function enforcePublicRateLimit(input: {
  route: string;
  headers: Headers;
  scopeId?: string;
  operation?: string;
  limit?: number;
  windowSeconds?: number;
}) {
  const sql =
    globalRateLimit.__clientweaveRateLimitSql ??
    (globalRateLimit.__clientweaveRateLimitSql = postgres(getEnvironment().DATABASE_URL, {
      max: 5,
      prepare: false
    }));
  const visitor = input.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return new DatabaseRateLimiter(sql).consume(
    {
      route: input.route,
      visitor,
      ...(input.scopeId ? { scopeId: input.scopeId } : {}),
      ...(input.operation ? { operation: input.operation } : {})
    },
    input.limit ?? 60,
    input.windowSeconds ?? 60
  );
}
