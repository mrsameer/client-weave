import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { createScopeRequestSchema } from "@/contracts/schemas/scope";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { createScope } from "@/modules/scope/application/create-scope";
import { recordCapabilityInvocation, requestedCapability } from "@/webmcp/invocation";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimit = await enforcePublicRateLimit({
    route: "/api/v1/scopes",
    headers: request.headers,
    operation: "create_scope",
    limit: 20
  });
  if (!rateLimit.allowed)
    return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
      retryable: true
    });
  const body = await request.json().catch(() => null);
  const parsed = createScopeRequestSchema.safeParse(body);
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid scope request",
      "Review the scope fields.",
      {
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      }
    );
  const pepper = process.env.SCOPE_CAPABILITY_PEPPER;
  if (!pepper)
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Scope creation is temporarily unavailable.",
      { retryable: true }
    );
  try {
    const db = createRuntimeDatabase();
    const service = await new CatalogRepository(db).findPublicActiveBySlug(parsed.data.serviceSlug);
    if (!service)
      return problemResponse(
        404,
        "NOT_FOUND",
        "Service unavailable",
        "The selected service is not available."
      );
    const result = await createScope(
      new ScopeRepository(db),
      {
        serviceId: service.id,
        goal: parsed.data.goal,
        budgetMaxMinor: parsed.data.budgetMaxMinor ?? null,
        targetDeliveryDate: parsed.data.targetDeliveryDate ?? null,
        assumptions: parsed.data.assumptions,
        answers: parsed.data.answers,
        actor: requestedCapability(request, "create_scope") ? "AGENT" : "HUMAN"
      },
      pepper
    );
    await recordCapabilityInvocation({
      db,
      request,
      scopeId: result.scope.id,
      capability: "create_scope",
      outcome: "SUCCEEDED",
      reason: "scope created"
    });
    return NextResponse.json(
      { ...result.scope, continuationUrl: result.continuationUrl },
      { status: 201 }
    );
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Scope creation is temporarily unavailable.",
      { retryable: true }
    );
  }
}
