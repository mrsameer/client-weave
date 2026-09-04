import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { QuoteRepository } from "@/db/repositories/quote-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { priceScopeRequestSchema } from "@/contracts/schemas/scope";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { priceScope } from "@/modules/pricing/application/price-scope";
import type { PricingRule } from "@/modules/pricing/domain/evaluator-v1";
import { recordCapabilityInvocation } from "@/webmcp/invocation";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";
import { normalizeScope } from "@/modules/scope/domain/normalize-scope";
import { validateScope } from "@/modules/scope/domain/validate-scope";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  const parsed = priceScopeRequestSchema.safeParse(await request.json().catch(() => null));
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid price request",
      "A valid scope revision is required."
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
      route: "/api/v1/scopes/current/quotes",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "price_scope",
      limit: 30
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const scope = await scopes.getById(access.scopeId);
    if (scope.revision !== parsed.data.expectedRevision)
      return problemResponse(
        409,
        "SCOPE_REVISION_CONFLICT",
        "Scope revision conflict",
        "Refresh the scope and retry pricing.",
        { retryable: true, currentRevision: scope.revision }
      );
    const catalog = new CatalogRepository(db);
    const [pricing, workspaceId] = await Promise.all([
      catalog.getCurrentPricing(scope.serviceId),
      catalog.workspaceIdForService(scope.serviceId)
    ]);
    if (!pricing || !workspaceId)
      return problemResponse(
        422,
        "QUOTE_INELIGIBLE",
        "Quote unavailable",
        "This scope does not have an active pricing rule set."
      );
    const result = await priceScope(new QuoteRepository(db), {
      scopeId: scope.id,
      scopeRevision: scope.revision,
      ruleSetId: pricing.ruleSetId,
      evaluatorVersion: "v1",
      workspaceId,
      currency: pricing.currency,
      pricingRuleVersion: pricing.ruleSetVersion,
      issues: validateScope(
        normalizeScope({
          goal: scope.goal,
          budgetMaxMinor: scope.budgetMaxMinor,
          targetDeliveryDate: scope.targetDeliveryDate?.toISOString() ?? null,
          assumptions: scope.assumptions.map((assumption) => assumption.value),
          answers: Object.fromEntries(
            Object.entries(scope.answers).map(([key, value]) => [key, value.value])
          )
        }),
        scope.fields
      ),
      assumptions: scope.assumptions.map((assumption) => ({
        value: assumption.value,
        actor: assumption.actor,
        updatedAt: assumption.updatedAt.toISOString()
      })),
      basePriceMinor: pricing.basePriceMinor,
      answers: Object.fromEntries(
        Object.entries(scope.answers).map(([key, value]) => [key, value.value])
      ),
      selectedAddons: Array.isArray(scope.answers.addons?.value)
        ? (scope.answers.addons.value as string[])
        : [],
      rules: pricing.rules as PricingRule[]
    });
    await recordCapabilityInvocation({
      db,
      request,
      scopeId: scope.id,
      capability: "price_scope",
      outcome: "SUCCEEDED",
      reason: "quote calculated"
    });
    return NextResponse.json({
      status: result.status,
      eligible: result.eligible,
      ...(result.currency === undefined ? {} : { currency: result.currency }),
      ...(result.minimumTotalMinor === undefined
        ? {}
        : { minimumTotalMinor: result.minimumTotalMinor }),
      ...(result.maximumTotalMinor === undefined
        ? {}
        : { maximumTotalMinor: result.maximumTotalMinor }),
      lineItems: result.lineItems,
      assumptions: result.assumptions,
      issues: result.issues,
      calculatedAt: result.calculatedAt,
      ...(result.pricingRuleVersion === undefined
        ? {}
        : { pricingRuleVersion: result.pricingRuleVersion })
    });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Pricing is temporarily unavailable.",
      { retryable: true }
    );
  }
}
