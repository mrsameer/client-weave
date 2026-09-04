import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRuntimeDatabase } from "@/db/client";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { FinalizationRepository } from "@/db/repositories/finalization-repository";
import { QuoteRepository } from "@/db/repositories/quote-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { createFinalSummary } from "@/modules/finalization/domain/final-summary";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

const schema = z
  .object({
    summaryHash: z.string().length(64),
    scopeRevision: z.number().int().positive(),
    expiresAt: z.string().datetime(),
    contact: z
      .object({ name: z.string().max(160).optional(), email: z.string().email().optional() })
      .strict(),
    action: z.enum(["SUBMIT_LEAD", "SUBMIT_LEAD_AND_BOOK"]),
    slotId: z.string().uuid().optional(),
    nonce: z.string().uuid()
  })
  .strict();
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  const csrf = request.cookies.get("clientweave_csrf")?.value;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  if (!csrf || request.headers.get("x-csrf-token") !== csrf)
    return problemResponse(403, "CSRF_REJECTED", "Request rejected", "Refresh the page and retry.");
  if (request.headers.has("x-clientweave-capability"))
    return problemResponse(
      403,
      "HUMAN_CONFIRMATION_REQUIRED",
      "Human confirmation required",
      "Confirm this action directly in the ordinary page."
    );
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid confirmation",
      "Review the current final summary."
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
      route: "/api/v1/scopes/current/human-confirmations",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "human_confirmation",
      limit: 10
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const scope = await scopes.getById(access.scopeId);
    if (
      scope.revision !== parsed.data.scopeRevision ||
      new Date(parsed.data.expiresAt) <= new Date()
    )
      return problemResponse(
        409,
        "CONFIRMATION_STALE",
        "Confirmation stale",
        "Review the current final summary again."
      );
    const [quote, constraints] = await Promise.all([
      new QuoteRepository(db).latestForScope(scope.id),
      new CatalogRepository(db).getCurrentConstraints(scope.serviceId)
    ]);
    if (!quote || quote.scopeRevision !== scope.revision)
      return problemResponse(
        409,
        "QUOTE_STALE",
        "Quote unavailable",
        "Request a current quote before confirming the final review."
      );
    const contact = {
      ...(parsed.data.contact.name === undefined ? {} : { name: parsed.data.contact.name }),
      ...(parsed.data.contact.email === undefined ? {} : { email: parsed.data.contact.email })
    };
    const summary = createFinalSummary({
      scopeRevision: scope.revision,
      quoteId: quote.id,
      quoteTotalMinor: quote.totalMinor,
      contact,
      action: parsed.data.action,
      ...(parsed.data.slotId ? { slotId: parsed.data.slotId } : {}),
      nonce: parsed.data.nonce,
      retentionNotice: "Lead information is retained according to the workspace policy.",
      scopeSnapshot: JSON.parse(JSON.stringify(scope)) as Record<string, unknown>,
      quoteSnapshot: quote.snapshot as Record<string, unknown>,
      serviceConstraints: constraints.map((constraint) => constraint.definition)
    });
    if (summary.hash !== parsed.data.summaryHash)
      return problemResponse(
        409,
        "CONFIRMATION_STALE",
        "Confirmation stale",
        "Review and confirm the exact current final summary again."
      );
    const confirmation = await new FinalizationRepository(db).recordConfirmation({
      scopeId: scope.id,
      scopeRevision: scope.revision,
      summaryHash: parsed.data.summaryHash,
      expiresAt: new Date(
        Math.min(new Date(parsed.data.expiresAt).getTime(), summary.expiresAt.getTime())
      )
    });
    return NextResponse.json(confirmation, { status: 201 });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Confirmation is temporarily unavailable.",
      { retryable: true }
    );
  }
}
