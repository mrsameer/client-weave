import { and, desc, eq } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { quotes } from "@/db/schema/scopes";
import { auditEvents } from "@/db/schema/audit";

type Database = ReturnType<typeof createRuntimeDatabase>;
export type NewQuote = {
  scopeId: string;
  scopeRevision: number;
  ruleSetId: string;
  inputHash: string;
  snapshot: object;
  totalMinor: number;
};

export class QuoteRepository {
  constructor(private readonly db: Database) {}
  async findExisting(
    input: Pick<NewQuote, "scopeId" | "scopeRevision" | "ruleSetId" | "inputHash">
  ) {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.scopeId, input.scopeId),
          eq(quotes.scopeRevision, input.scopeRevision),
          eq(quotes.ruleSetId, input.ruleSetId),
          eq(quotes.inputHash, input.inputHash)
        )
      );
    return quote ?? null;
  }
  async persist(input: NewQuote) {
    const [inserted] = await this.db
      .insert(quotes)
      .values(input)
      .onConflictDoNothing({
        target: [quotes.scopeId, quotes.scopeRevision, quotes.ruleSetId, quotes.inputHash]
      })
      .returning();
    if (inserted) return inserted;
    const existing = await this.findExisting(input);
    if (existing) return existing;
    throw new Error("Quote insert conflicted but no canonical quote was found");
  }
  async latestForScope(scopeId: string) {
    const [quote] = await this.db
      .select()
      .from(quotes)
      .where(eq(quotes.scopeId, scopeId))
      .orderBy(desc(quotes.createdAt));
    return quote ?? null;
  }

  async appendPriceAudit(input: {
    workspaceId: string;
    scopeId: string;
    scopeRevision: number;
    ruleSetId: string;
    inputHash: string;
  }) {
    await this.db.insert(auditEvents).values({
      workspaceId: input.workspaceId,
      scopeId: input.scopeId,
      actor: "SYSTEM",
      action: "SCOPE_PRICED",
      outcome: "SUCCEEDED",
      metadata: {
        scopeRevision: input.scopeRevision,
        ruleSetId: input.ruleSetId,
        inputHash: input.inputHash,
        evaluatorVersion: "v1"
      }
    });
  }
}
