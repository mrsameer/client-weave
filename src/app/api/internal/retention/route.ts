import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import {
  deleteRetainedFinalizedScopes,
  expireDrafts
} from "@/modules/scope/application/expire-drafts";
import { problemResponse } from "@/contracts/problems/to-problem-response";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const secret = process.env.RETENTION_CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return problemResponse(
      401,
      "UNAUTHORIZED",
      "Unauthorized",
      "A valid scheduler credential is required."
    );
  try {
    const repository = new ScopeRepository(createRuntimeDatabase());
    const [expiredDrafts, deletedFinalizedScopes] = await Promise.all([
      expireDrafts(repository),
      deleteRetainedFinalizedScopes(repository)
    ]);
    return NextResponse.json({ expiredDrafts, deletedFinalizedScopes });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Retention processing is temporarily unavailable.",
      { retryable: true }
    );
  }
}
