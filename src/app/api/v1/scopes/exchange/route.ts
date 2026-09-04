import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRuntimeDatabase } from "@/db/client";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import {
  createScopeSessionSecret,
  csrfToken,
  hashScopeSecret,
  scopeCookie
} from "@/server/auth/scope-capability";

const requestSchema = z
  .object({ scopeRef: z.string().min(16).max(128), secret: z.string().min(43).max(512) })
  .strict();
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return problemResponse(
      400,
      "VALIDATION_ERROR",
      "Invalid scope session request",
      "The capability exchange payload is invalid."
    );
  const pepper = process.env.SCOPE_CAPABILITY_PEPPER;
  if (!pepper)
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Scope access is temporarily unavailable.",
      { retryable: true }
    );
  const tokenHash = hashScopeSecret(parsed.data.secret, pepper);
  try {
    const sessionTokenHash = hashScopeSecret(createScopeSessionSecret(), pepper);
    const access = await new ScopeRepository(createRuntimeDatabase()).exchangeCapability({
      ref: parsed.data.scopeRef,
      fragmentTokenHash: tokenHash,
      sessionTokenHash,
      now: new Date()
    });
    if (!access)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(scopeCookie(sessionTokenHash));
    response.cookies.set({
      name: "clientweave_csrf",
      value: csrfToken(),
      httpOnly: false,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
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
