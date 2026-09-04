import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { problemDetailsSchema } from "../../src/contracts/problems/problem-details";
import { problemResponse } from "../../src/contracts/problems/to-problem-response";
import { requestJson } from "../../src/contracts/http/client";
import { createScopeRequestSchema, updateScopeRequestSchema } from "../../src/contracts/schemas";
import { POST as exchangeScopeCapability } from "../../src/app/api/v1/scopes/exchange/route";
import { POST as recordHumanConfirmation } from "../../src/app/api/v1/scopes/current/human-confirmations/route";

describe("foundation HTTP contracts", () => {
  it("emits a valid secret-free RFC 9457 envelope", async () => {
    const response = problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid token=scope-secret",
      "buyer@example.test supplied an invalid request"
    );
    const body = await response.json();
    expect(problemDetailsSchema.safeParse(body).success).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/scope-secret|buyer@example/);
  });

  it("rejects unknown fields at create and update typed boundaries", () => {
    expect(
      createScopeRequestSchema.safeParse({
        serviceSlug: "brand-strategy",
        goal: "Clarify launch positioning",
        totalMinor: 1
      }).success
    ).toBe(false);
    expect(
      updateScopeRequestSchema.safeParse({ goal: "Updated goal", actor: "AGENT" }).success
    ).toBe(false);
  });

  it("keeps caller-provided cookie, bearer, capability, and If-Match headers intact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    await requestJson("/api/v1/scopes/current", {
      method: "PATCH",
      headers: {
        authorization: "Bearer scope-token",
        cookie: "__Host-clientweave_scope=session-token",
        "x-clientweave-capability": "update_scope",
        "if-match": '"7"'
      }
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer scope-token");
    expect(headers.get("cookie")).toBe("__Host-clientweave_scope=session-token");
    expect(headers.get("x-clientweave-capability")).toBe("update_scope");
    expect(headers.get("if-match")).toBe('"7"');
    vi.unstubAllGlobals();
  });

  it("adds the browser CSRF cookie to mutation requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { cookie: "clientweave_csrf=browser-token" });

    await requestJson("/api/v1/scopes", { method: "POST" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("x-csrf-token")).toBe("browser-token");
    vi.unstubAllGlobals();
  });

  it("rejects malformed capability exchanges and agent-originated human confirmation before storage", async () => {
    const exchange = await exchangeScopeCapability(
      new NextRequest("http://clientweave.test/api/v1/scopes/exchange", {
        method: "POST",
        body: JSON.stringify({ scopeRef: "too-short", secret: "also-too-short", extra: true })
      })
    );
    expect(exchange.status).toBe(400);
    expect((await exchange.json()).code).toBe("VALIDATION_ERROR");

    const confirmation = await recordHumanConfirmation(
      new NextRequest("http://clientweave.test/api/v1/scopes/current/human-confirmations", {
        method: "POST",
        headers: {
          cookie: "__Host-clientweave_scope=session-token; clientweave_csrf=csrf-token",
          "x-csrf-token": "csrf-token",
          "x-clientweave-capability": "finalize_confirmed_scope"
        },
        body: JSON.stringify({})
      })
    );
    expect(confirmation.status).toBe(403);
    expect((await confirmation.json()).code).toBe("HUMAN_CONFIRMATION_REQUIRED");
  });

  it("declares the exchange and public service-detail routes in OpenAPI", async () => {
    const contract = parse(
      await readFile(resolve("specs/001-agent-service-cpq/contracts/openapi.yaml"), "utf8")
    ) as {
      paths: Record<
        string,
        {
          get?: { operationId?: string; responses?: Record<string, unknown> };
          post?: { operationId?: string };
        }
      >;
    };
    expect(contract.paths["/scopes/exchange"]?.post?.operationId).toBe("exchange_scope_capability");
    const serviceDetail = contract.paths["/services/{slug}"]?.get;
    expect(serviceDetail?.operationId).toBe("get_active_service");
    expect(serviceDetail?.responses?.["429"]).toEqual({
      $ref: "#/components/responses/RateLimited"
    });
  });
});
