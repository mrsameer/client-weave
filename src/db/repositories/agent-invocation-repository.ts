import { desc, eq } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { agentInvocations } from "@/db/schema/audit";

type Database = ReturnType<typeof createRuntimeDatabase>;

export class AgentInvocationRepository {
  constructor(private readonly db: Database) {}

  async recentForScope(scopeId: string, limit = 30) {
    return this.db
      .select({
        capability: agentInvocations.capability,
        outcome: agentInvocations.outcome,
        reason: agentInvocations.reason,
        createdAt: agentInvocations.createdAt
      })
      .from(agentInvocations)
      .where(eq(agentInvocations.scopeId, scopeId))
      .orderBy(desc(agentInvocations.createdAt))
      .limit(Math.min(Math.max(limit, 1), 50));
  }

  async append(input: {
    scopeId: string;
    capability: string;
    stateEffect: "READ_ONLY" | "DRAFT_MUTATION" | "DERIVED_RECORD_WRITE" | "CONSEQUENTIAL_WRITE";
    outcome: "SUCCEEDED" | "REJECTED" | "FAILED";
    reason: string;
  }) {
    await this.db.insert(agentInvocations).values({
      ...input,
      // Invocation records must remain a categorical audit summary, never raw arguments or errors.
      reason: sanitizeInvocationReason(input.reason)
    });
  }
}

export function sanitizeInvocationReason(reason: string) {
  return reason
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted]")
    .replace(/(token|secret|authorization|cookie)\s*[:=]\s*(?:Bearer\s+)?\S+/gi, "$1=[redacted]")
    .slice(0, 240);
}
