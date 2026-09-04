import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../src/middleware";

describe("security middleware", () => {
  it("rejects cross-origin API mutations and sets no-referrer policy", () => {
    const rejected = middleware(
      new NextRequest("https://clientweave.test/api/v1/scopes", {
        method: "POST",
        headers: { origin: "https://evil.test" }
      })
    );
    expect(rejected.status).toBe(403);
    const accepted = middleware(
      new NextRequest("https://clientweave.test/", {
        headers: { origin: "https://clientweave.test" }
      })
    );
    expect(accepted.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(accepted.headers.get("Content-Security-Policy")).toMatch(
      /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/
    );
    expect(accepted.headers.get("Content-Security-Policy")).not.toMatch(
      /script-src[^;]*'unsafe-inline'/
    );
  });
});
