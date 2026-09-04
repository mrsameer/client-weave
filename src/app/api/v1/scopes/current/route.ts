import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { updateScope } from "@/modules/scope/application/update-scope";
import { recordCapabilityInvocation, requestedCapability } from "@/webmcp/invocation";
import { scopeBroadcast } from "@/server/realtime/scope-broadcast";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  try {
    const db = createRuntimeDatabase();
    const repository = new ScopeRepository(db);
    const access = await repository.findCapabilityAccessByHash(tokenHash);
    if (!access || access.expiresAt <= new Date() || access.revokedAt)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    return NextResponse.json(await repository.getById(access.scopeId));
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Scope access is temporarily unavailable.",
      { retryable: true }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  const csrfCookie = request.cookies.get("clientweave_csrf")?.value;
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  if (!csrfCookie || request.headers.get("x-csrf-token") !== csrfCookie)
    return problemResponse(403, "CSRF_REJECTED", "Request rejected", "Refresh the page and retry.");
  const match = request.headers.get("if-match")?.match(/^"(\d+)"$/);
  if (!match)
    return problemResponse(
      428,
      "PRECONDITION_REQUIRED",
      "Revision required",
      "Use the quoted current scope revision in If-Match."
    );
  try {
    const patch = await request.json();
    const db = createRuntimeDatabase();
    const repository = new ScopeRepository(db);
    const access = await repository.findCapabilityAccessByHash(tokenHash);
    if (!access || access.expiresAt <= new Date() || access.revokedAt)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    const rateLimit = await enforcePublicRateLimit({
      route: "/api/v1/scopes/current",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "update_scope",
      limit: 30
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const isAgent = requestedCapability(request, "update_scope");
    const updated = await updateScope(repository, {
      scopeId: access.scopeId,
      expectedRevision: Number(match[1]),
      actor: isAgent ? "AGENT" : "HUMAN",
      patch
    });
    if (!updated) {
      await recordCapabilityInvocation({
        db,
        request,
        scopeId: access.scopeId,
        capability: "update_scope",
        outcome: "REJECTED",
        reason: "revision conflict"
      });
      return problemResponse(
        412,
        "SCOPE_REVISION_CONFLICT",
        "Scope revision conflict",
        "The scope changed. Refresh before applying your update.",
        { retryable: true }
      );
    }
    await recordCapabilityInvocation({
      db,
      request,
      scopeId: access.scopeId,
      capability: "update_scope",
      outcome: "SUCCEEDED",
      reason: "scope updated"
    });
    scopeBroadcast.publish({
      scopeId: access.scopeId,
      revision: updated.revision,
      changedAt: new Date().toISOString()
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof TypeError)
      return problemResponse(400, "VALIDATION_ERROR", "Invalid scope update", error.message);
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Scope updates are temporarily unavailable.",
      { retryable: true }
    );
  }
}
