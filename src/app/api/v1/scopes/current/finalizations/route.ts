import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRuntimeDatabase } from "@/db/client";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import {
  FinalizationRepository,
  FinalizationTransactionError
} from "@/db/repositories/finalization-repository";
import { QuoteRepository } from "@/db/repositories/quote-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { finalizeConfirmedScope } from "@/modules/finalization/application/finalize-confirmed-scope";
import { createFinalSummary } from "@/modules/finalization/domain/final-summary";
import { recordCapabilityInvocation } from "@/webmcp/invocation";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

const inputSchema = z
  .object({
    summaryHash: z.string().length(64),
    nonce: z.string().uuid(),
    contact: z
      .object({ name: z.string().max(160).optional(), email: z.string().email().optional() })
      .strict(),
    action: z.enum(["SUBMIT_LEAD", "SUBMIT_LEAD_AND_BOOK"]),
    slotId: z.string().uuid().optional()
  })
  .strict();
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  const csrf = request.cookies.get("clientweave_csrf")?.value;
  const idempotencyKey = request.headers.get("idempotency-key");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  if (!csrf || request.headers.get("x-csrf-token") !== csrf)
    return problemResponse(403, "CSRF_REJECTED", "Request rejected", "Refresh the page and retry.");
  if (!idempotencyKey || idempotencyKey.length > 200)
    return problemResponse(
      400,
      "IDEMPOTENCY_REQUIRED",
      "Idempotency key required",
      "Retry with a valid idempotency key."
    );
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid finalization",
      "Review the final summary."
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
      route: "/api/v1/scopes/current/finalizations",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "finalize_confirmed_scope",
      limit: 5
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const scope = await scopes.getById(access.scopeId);
    const catalog = new CatalogRepository(db);
    const [quote, workspaceId, constraints] = await Promise.all([
      new QuoteRepository(db).latestForScope(scope.id),
      catalog.workspaceIdForService(scope.serviceId),
      catalog.getCurrentConstraints(scope.serviceId)
    ]);
    if (!quote || quote.scopeRevision !== scope.revision)
      return problemResponse(
        422,
        "QUOTE_STALE",
        "Quote unavailable",
        "Request a current quote before finalizing."
      );
    if (!workspaceId)
      return problemResponse(
        404,
        "SERVICE_UNAVAILABLE",
        "Service unavailable",
        "The service is unavailable."
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
        "Final review changed",
        "Review and confirm the current summary again."
      );
    const result = await finalizeConfirmedScope(new FinalizationRepository(db), {
      scopeId: scope.id,
      workspaceId,
      scopeRevision: scope.revision,
      quoteId: quote.id,
      summaryHash: summary.hash,
      contact,
      action: parsed.data.action,
      ...(parsed.data.slotId ? { slotId: parsed.data.slotId } : {}),
      idempotencyKey
    });
    if (!result.ok) {
      const status =
        result.code === "SLOT_REQUIRED"
          ? 400
          : result.code === "FINALIZATION_IN_PROGRESS"
            ? 409
            : 422;
      return problemResponse(
        status,
        result.code,
        "Finalization unavailable",
        "Review the final action and retry."
      );
    }
    await recordCapabilityInvocation({
      db,
      request,
      scopeId: scope.id,
      capability: "finalize_confirmed_scope",
      outcome: "SUCCEEDED",
      reason: result.replayed ? "finalization replayed" : "scope finalized"
    });
    return NextResponse.json(result.response, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof FinalizationTransactionError)
      return problemResponse(
        409,
        error.code,
        "Finalization unavailable",
        "The selected slot or confirmation is no longer current."
      );
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Finalization is temporarily unavailable.",
      {
        retryable: true
      }
    );
  }
}
