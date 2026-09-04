import { NextRequest, NextResponse } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { AgentInvocationRepository } from "@/db/repositories/agent-invocation-repository";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { problemResponse } from "@/contracts/problems/to-problem-response";
import { capabilityInspector } from "@/webmcp/inspector";

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
    const access = await new ScopeRepository(db).findCapabilityAccessByHash(tokenHash);
    if (!access || access.expiresAt <= new Date() || access.revokedAt)
      return problemResponse(
        404,
        "SCOPE_UNAVAILABLE",
        "Scope unavailable",
        "The scope is unavailable."
      );
    const invocations = await new AgentInvocationRepository(db).recentForScope(access.scopeId);
    return NextResponse.json({ capabilities: capabilityInspector(invocations) });
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Inspector is temporarily unavailable.",
      { retryable: true }
    );
  }
}
