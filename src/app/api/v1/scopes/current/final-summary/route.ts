import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createRuntimeDatabase } from "@/db/client";
import { QuoteRepository } from "@/db/repositories/quote-repository";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { createFinalSummary } from "@/modules/finalization/domain/final-summary";
import { enforcePublicRateLimit } from "@/server/rate-limit/public-rate-limit";

const inputSchema = z
  .object({
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
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
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
      "Invalid final summary",
      "Review contact details and the selected action."
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
      route: "/api/v1/scopes/current/final-summary",
      headers: request.headers,
      scopeId: access.scopeId,
      operation: "create_final_summary",
      limit: 20
    });
    if (!rateLimit.allowed)
      return problemResponse(429, "RATE_LIMITED", "Too many requests", "Retry shortly.", {
        retryable: true
      });
    const scope = await scopes.getById(access.scopeId);
    const [quote, constraints] = await Promise.all([
      new QuoteRepository(db).latestForScope(scope.id),
      new CatalogRepository(db).getCurrentConstraints(scope.serviceId)
    ]);
    if (!quote || quote.scopeRevision !== scope.revision)
      return problemResponse(
        422,
        "QUOTE_STALE",
        "Quote unavailable",
        "Request a current quote before reviewing finalization."
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
      ...(parsed.data.slotId === undefined ? {} : { slotId: parsed.data.slotId }),
      nonce: randomUUID(),
      retentionNotice: "Lead information is retained according to the workspace policy.",
      scopeSnapshot: JSON.parse(JSON.stringify(scope)) as Record<string, unknown>,
      quoteSnapshot: quote.snapshot as Record<string, unknown>,
      serviceConstraints: constraints.map((constraint) => constraint.definition)
    });
    return NextResponse.json({ scope, quote, summary });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Final review is temporarily unavailable.",
      { retryable: true }
    );
  }
}
