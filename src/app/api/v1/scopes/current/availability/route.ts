import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { AvailabilityRepository } from "@/db/repositories/availability-repository";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { QuoteRepository } from "@/db/repositories/quote-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { findConsultationSlots } from "@/modules/availability/application/find-consultation-slots";
import { recordCapabilityInvocation } from "@/webmcp/invocation";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "10");
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  if (!Number.isInteger(limit) || limit < 1 || limit > 30)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid availability request",
      "Limit must be between 1 and 30."
    );
  try {
    const db = createRuntimeDatabase();
    const scopes = new ScopeRepository(db);
    const access = await scopes.findCapabilityAccessByHash(tokenHash);
    if (!access || access.expiresAt <= new Date() || access.revokedAt)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    const rateLimit = await enforcePublicRateLimit({
      route: "/api/v1/scopes/current/availability",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "find_consultation_slots"
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const scope = await scopes.getById(access.scopeId);
    const [workspaceId, quote] = await Promise.all([
      new CatalogRepository(db).workspaceIdForService(scope.serviceId),
      new QuoteRepository(db).latestForScope(scope.id)
    ]);
    if (!workspaceId)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    if (!quote || quote.scopeRevision !== scope.revision)
      return problemResponse(
        422,
        "QUOTE_STALE",
        "Quote unavailable",
        "Request a current quote before viewing availability."
      );
    const slots = await findConsultationSlots(new AvailabilityRepository(db), {
      workspaceId,
      serviceId: scope.serviceId,
      quoteCurrent: true,
      limit
    });
    await recordCapabilityInvocation({
      db,
      request,
      scopeId: scope.id,
      capability: "find_consultation_slots",
      outcome: "SUCCEEDED",
      reason: "availability viewed"
    });
    return NextResponse.json({ timezone: "America/New_York", slots });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Availability is temporarily unavailable.",
      { retryable: true }
    );
  }
}
