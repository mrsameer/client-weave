import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../../src/middleware";

describe("security middleware", () => {
  it("rejects cross-origin API mutations and sets browser security policy", () => {
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
    expect(accepted.cookies.get("clientweave_csrf")?.value).toBeTruthy();
  });

  it("accepts a same-origin mutation behind an HTTPS reverse proxy", () => {
    const response = middleware(
      new NextRequest("http://127.0.0.1:3100/api/v1/scopes", {
        method: "POST",
        headers: {
          cookie: "clientweave_csrf=proxy-token",
          host: "127.0.0.1:3100",
          origin: "https://demo.example",
          "x-csrf-token": "proxy-token",
          "x-forwarded-host": "demo.example",
          "x-forwarded-proto": "https"
        }
      })
    );

    expect(response.status).toBe(200);
  });

  it("rejects a mutation whose CSRF header does not match its cookie", () => {
    const response = middleware(
      new NextRequest("https://clientweave.test/api/v1/scopes", {
        method: "POST",
        headers: {
          cookie: "clientweave_csrf=cookie-token",
          host: "clientweave.test",
          origin: "https://clientweave.test",
          "x-csrf-token": "different-token"
        }
      })
    );

    expect(response.status).toBe(403);
  });
});
