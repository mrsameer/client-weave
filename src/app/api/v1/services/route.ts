import { NextRequest, NextResponse } from "next/server";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { createRuntimeDatabase } from "@/db/client";
import { discoverServicesQuerySchema } from "@/contracts/schemas/catalog";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { matchServices } from "@/modules/catalog/domain/match-service";
import { recordCapabilityInvocation } from "@/webmcp/invocation";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rateLimit = await enforcePublicRateLimit({
    route: "/api/v1/services",
    headers: request.headers,
    operation: "discover_services"
  });
  if (!rateLimit.allowed)
    return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
      retryable: true
    });
  const values = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = discoverServicesQuerySchema.safeParse({
    ...values,
    budgetMaxMinor: values.budgetMaxMinor === undefined ? undefined : Number(values.budgetMaxMinor),
    limit: values.limit === undefined ? undefined : Number(values.limit)
  });
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid discovery request",
      "Review the supplied service-discovery fields.",
      {
        fieldErrors: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message
        }))
      }
    );
  try {
    const db = createRuntimeDatabase();
    const services = await new CatalogRepository(db).listPublicActive();
    const matchRequest = {
      need: parsed.data.need,
      ...(parsed.data.budgetMaxMinor === undefined
        ? {}
        : { budgetMaxMinor: parsed.data.budgetMaxMinor }),
      ...(parsed.data.desiredDeliveryDate === undefined
        ? {}
        : { desiredDeliveryDate: parsed.data.desiredDeliveryDate })
    };
    const results = matchServices(services, matchRequest).slice(0, parsed.data.limit);
    const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
    if (tokenHash) {
      const access = await new ScopeRepository(db).findCapabilityAccessByHash(tokenHash);
      if (access && access.expiresAt > new Date() && !access.revokedAt)
        await recordCapabilityInvocation({
          db,
          request,
          scopeId: access.scopeId,
          capability: "discover_services",
          outcome: "SUCCEEDED",
          reason: "services discovered"
        });
    }
    return NextResponse.json({ services: results });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Please retry discovery shortly.",
      { retryable: true }
    );
  }
}
