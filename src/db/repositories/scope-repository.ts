import { and, asc, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { agentInvocations, auditEvents } from "@/db/schema/audit";
import { scopeFields, serviceOfferings, serviceVersions, workspaces } from "@/db/schema/catalog";
import type { FieldDefinition } from "@/modules/scope/domain/normalize-scope";
import {
  bookings,
  humanConfirmations,
  idempotencyRecords,
  qualifiedLeads
} from "@/db/schema/finalization";
import {
  scopeAnswers,
  scopeAssumptions,
  scopeParticipants,
  scopeSessions,
  quotes
} from "@/db/schema/scopes";

type Database = ReturnType<typeof createRuntimeDatabase>;
export type TrustedActor = "HUMAN" | "AGENT" | "IMPORTED" | "SYSTEM";
export type ScopeValue = string | number | boolean | string[] | null;
export type NewScope = {
  ref: string;
  serviceId: string;
  goal: string;
  budgetMaxMinor: number | null;
  targetDeliveryDate: Date | null;
  assumptions: string[];
  answers: Record<string, ScopeValue>;
  actor: TrustedActor;
  expiresAt: Date;
  tokenHash: string;
};

export type StoredScope = {
  id: string;
  ref: string;
  revision: number;
  serviceId: string;
  goal: string;
  goalActor: string;
  goalUpdatedAt: Date;
  budgetMaxMinor: number | null;
  budgetActor: string;
  budgetUpdatedAt: Date;
  targetDeliveryDate: Date | null;
  deliveryActor: string;
  deliveryUpdatedAt: Date;
  expiresAt: Date;
  assumptions: Array<{ value: string; actor: string; updatedAt: Date }>;
  answers: Record<string, { value: ScopeValue; actor: string; updatedAt: Date }>;
  fields: FieldDefinition[];
};

export type ScopeMutation = {
  expectedRevision: number;
  actor: TrustedActor;
  goal?: string;
  budgetMaxMinor?: number | null;
  targetDeliveryDate?: Date | null;
  assumptions?: string[];
  answers?: Record<string, ScopeValue>;
};

export class ScopeRepository {
  constructor(private readonly db: Database) {}
  async create(input: NewScope): Promise<StoredScope> {
    const scope = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(scopeSessions)
        .values({
          ref: input.ref,
          serviceId: input.serviceId,
          goal: input.goal,
          goalActor: input.actor,
          budgetMaxMinor: input.budgetMaxMinor,
          budgetActor: input.actor,
          targetDeliveryDate: input.targetDeliveryDate,
          deliveryActor: input.actor,
          expiresAt: input.expiresAt
        })
        .returning();
      if (!created) throw new Error("Scope insert did not return a record");
      if (input.assumptions.length)
        await tx.insert(scopeAssumptions).values(
          input.assumptions.map((value, displayOrder) => ({
            scopeId: created.id,
            value,
            actor: input.actor,
            displayOrder
          }))
        );
      const entries = Object.entries(input.answers);
      if (entries.length)
        await tx.insert(scopeAnswers).values(
          entries.map(([fieldKey, value]) => ({
            scopeId: created.id,
            fieldKey,
            value,
            actor: input.actor
          }))
        );
      await tx
        .insert(scopeParticipants)
        .values({ scopeId: created.id, tokenHash: input.tokenHash });
      return created;
    });
    return this.getById(scope.id);
  }
  async getById(scopeId: string): Promise<StoredScope> {
    const [scope] = await this.db.select().from(scopeSessions).where(eq(scopeSessions.id, scopeId));
    if (!scope) throw new Error("Scope unavailable");
    const [assumptions, answers, fields] = await Promise.all([
      this.db
        .select()
        .from(scopeAssumptions)
        .where(eq(scopeAssumptions.scopeId, scope.id))
        .orderBy(asc(scopeAssumptions.displayOrder)),
      this.db.select().from(scopeAnswers).where(eq(scopeAnswers.scopeId, scope.id)),
      this.db
        .select({ definition: scopeFields.definition, displayOrder: scopeFields.displayOrder })
        .from(scopeFields)
        .innerJoin(serviceVersions, eq(scopeFields.serviceVersionId, serviceVersions.id))
        .innerJoin(serviceOfferings, eq(serviceVersions.id, serviceOfferings.activeVersionId))
        .where(eq(serviceOfferings.id, scope.serviceId))
        .orderBy(asc(scopeFields.displayOrder))
    ]);
    return {
      ...scope,
      assumptions,
      answers: Object.fromEntries(
        answers.map((answer) => [
          answer.fieldKey,
          { value: answer.value as ScopeValue, actor: answer.actor, updatedAt: answer.updatedAt }
        ])
      ),
      fields: fields.map((field) => field.definition as FieldDefinition)
    };
  }
  async getByReference(ref: string): Promise<StoredScope> {
    const [scope] = await this.db
      .select({ id: scopeSessions.id })
      .from(scopeSessions)
      .where(eq(scopeSessions.ref, ref));
    if (!scope) throw new Error("Scope unavailable");
    return this.getById(scope.id);
  }

  async findCapabilityAccess(ref: string, tokenHash: string) {
    const [result] = await this.db
      .select({
        scopeId: scopeSessions.id,
        expiresAt: scopeSessions.expiresAt,
        revokedAt: scopeParticipants.revokedAt
      })
      .from(scopeParticipants)
      .innerJoin(scopeSessions, eq(scopeParticipants.scopeId, scopeSessions.id))
      .where(and(eq(scopeParticipants.tokenHash, tokenHash), eq(scopeSessions.ref, ref)));
    return result ?? null;
  }

  async findCapabilityAccessByHash(tokenHash: string) {
    const [result] = await this.db
      .select({
        scopeId: scopeSessions.id,
        expiresAt: scopeSessions.expiresAt,
        revokedAt: scopeParticipants.revokedAt
      })
      .from(scopeParticipants)
      .innerJoin(scopeSessions, eq(scopeParticipants.scopeId, scopeSessions.id))
      .where(eq(scopeParticipants.tokenHash, tokenHash));
    return result ?? null;
  }

  /** Consumes a fragment capability and mints a separate browser-session capability. */
  async exchangeCapability(input: {
    ref: string;
    fragmentTokenHash: string;
    sessionTokenHash: string;
    now: Date;
  }) {
    return this.db.transaction(async (tx) => {
      const [access] = await tx
        .select({ scopeId: scopeSessions.id, participantId: scopeParticipants.id })
        .from(scopeParticipants)
        .innerJoin(scopeSessions, eq(scopeParticipants.scopeId, scopeSessions.id))
        .where(
          and(
            eq(scopeParticipants.tokenHash, input.fragmentTokenHash),
            eq(scopeSessions.ref, input.ref),
            isNull(scopeParticipants.revokedAt),
            gt(scopeSessions.expiresAt, input.now)
          )
        );
      if (!access) return null;
      const [consumed] = await tx
        .update(scopeParticipants)
        .set({ revokedAt: input.now })
        .where(
          and(eq(scopeParticipants.id, access.participantId), isNull(scopeParticipants.revokedAt))
        )
        .returning({ id: scopeParticipants.id });
      if (!consumed) return null;
      await tx.insert(scopeParticipants).values({
        scopeId: access.scopeId,
        tokenHash: input.sessionTokenHash
      });
      return { scopeId: access.scopeId };
    });
  }

  async update(scopeId: string, mutation: ScopeMutation): Promise<StoredScope | null> {
    const updated = await this.db.transaction(async (tx) => {
      const now = new Date();
      const values = {
        revision: sql`${scopeSessions.revision} + 1`,
        updatedAt: now,
        ...(mutation.goal === undefined
          ? {}
          : { goal: mutation.goal, goalActor: mutation.actor, goalUpdatedAt: now }),
        ...(mutation.budgetMaxMinor === undefined
          ? {}
          : {
              budgetMaxMinor: mutation.budgetMaxMinor,
              budgetActor: mutation.actor,
              budgetUpdatedAt: now
            }),
        ...(mutation.targetDeliveryDate === undefined
          ? {}
          : {
              targetDeliveryDate: mutation.targetDeliveryDate,
              deliveryActor: mutation.actor,
              deliveryUpdatedAt: now
            })
      };
      const [scope] = await tx
        .update(scopeSessions)
        .set(values)
        .where(
          and(eq(scopeSessions.id, scopeId), eq(scopeSessions.revision, mutation.expectedRevision))
        )
        .returning({ id: scopeSessions.id, serviceId: scopeSessions.serviceId });
      if (!scope) return null;
      if (mutation.assumptions !== undefined) {
        const existing = await tx
          .select()
          .from(scopeAssumptions)
          .where(eq(scopeAssumptions.scopeId, scope.id))
          .orderBy(asc(scopeAssumptions.displayOrder));
        for (const [displayOrder, value] of mutation.assumptions.entries()) {
          const previous = existing[displayOrder];
          if (!previous)
            await tx.insert(scopeAssumptions).values({
              scopeId: scope.id,
              value,
              actor: mutation.actor,
              displayOrder
            });
          else if (previous.value !== value)
            await tx
              .update(scopeAssumptions)
              .set({ value, actor: mutation.actor, updatedAt: new Date() })
              .where(eq(scopeAssumptions.id, previous.id));
        }
        for (const previous of existing.slice(mutation.assumptions.length))
          await tx.delete(scopeAssumptions).where(eq(scopeAssumptions.id, previous.id));
      }
      if (mutation.answers !== undefined) {
        const answers = Object.entries(mutation.answers);
        if (answers.length)
          await tx
            .insert(scopeAnswers)
            .values(
              answers.map(([fieldKey, value]) => ({
                scopeId: scope.id,
                fieldKey,
                value,
                actor: mutation.actor
              }))
            )
            .onConflictDoUpdate({
              target: [scopeAnswers.scopeId, scopeAnswers.fieldKey],
              set: { value: sql`excluded.value`, actor: mutation.actor, updatedAt: new Date() }
            });
      }
      await tx
        .update(humanConfirmations)
        .set({ invalidatedAt: new Date() })
        .where(
          and(eq(humanConfirmations.scopeId, scope.id), isNull(humanConfirmations.invalidatedAt))
        );
      const [service] = await tx
        .select({ workspaceId: serviceOfferings.workspaceId })
        .from(serviceOfferings)
        .where(eq(serviceOfferings.id, scope.serviceId));
      if (service)
        await tx.insert(auditEvents).values({
          workspaceId: service.workspaceId,
          scopeId: scope.id,
          actor: mutation.actor,
          action: "SCOPE_UPDATED",
          outcome: "SUCCEEDED",
          metadata: { revision: mutation.expectedRevision + 1 }
        });
      return scope;
    });
    return updated ? this.getById(updated.id) : null;
  }

  async findExpiredDrafts(now: Date) {
    return this.db
      .select({ id: scopeSessions.id, expiresAt: scopeSessions.expiresAt })
      .from(scopeSessions)
      .where(and(lte(scopeSessions.expiresAt, now), isNull(scopeSessions.finalizedAt)));
  }

  /** Conditional update makes repeated scheduled invocations harmless. */
  async expireAndRevoke(scopeId: string, now: Date): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [expired] = await tx
        .update(scopeSessions)
        .set({ updatedAt: now })
        .where(
          and(
            eq(scopeSessions.id, scopeId),
            lte(scopeSessions.expiresAt, now),
            isNull(scopeSessions.finalizedAt)
          )
        )
        .returning({ id: scopeSessions.id, serviceId: scopeSessions.serviceId });
      if (!expired) return;
      await tx
        .update(scopeParticipants)
        .set({ revokedAt: now })
        .where(and(eq(scopeParticipants.scopeId, expired.id), isNull(scopeParticipants.revokedAt)));
      const [service] = await tx
        .select({ workspaceId: serviceOfferings.workspaceId })
        .from(serviceOfferings)
        .where(eq(serviceOfferings.id, expired.serviceId));
      if (service)
        await tx.insert(auditEvents).values({
          workspaceId: service.workspaceId,
          scopeId: expired.id,
          actor: "SYSTEM",
          action: "SCOPE_EXPIRED",
          outcome: "SUCCEEDED",
          metadata: {}
        });
    });
  }

  async findFinalizedPastRetention(now: Date) {
    return this.db
      .select({ id: scopeSessions.id, workspaceId: workspaces.id })
      .from(scopeSessions)
      .innerJoin(serviceOfferings, eq(scopeSessions.serviceId, serviceOfferings.id))
      .innerJoin(workspaces, eq(serviceOfferings.workspaceId, workspaces.id))
      .where(
        and(
          isNotNull(scopeSessions.finalizedAt),
          sql`${scopeSessions.finalizedAt} <= (${now.toISOString()}::timestamptz - (${workspaces.retentionDays} * interval '1 day'))`
        )
      );
  }

  /** Deletes finalized records only after the owning workspace's retention period. */
  async deleteFinalizedForRetention(
    scope: { id: string; workspaceId: string },
    now: Date
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select({ id: scopeSessions.id })
        .from(scopeSessions)
        .where(and(eq(scopeSessions.id, scope.id), isNotNull(scopeSessions.finalizedAt)))
        .for("update");
      if (!candidate) return;
      await tx
        .update(auditEvents)
        .set({ scopeId: null })
        .where(eq(auditEvents.scopeId, candidate.id));
      await tx.delete(agentInvocations).where(eq(agentInvocations.scopeId, candidate.id));
      await tx.delete(bookings).where(eq(bookings.scopeId, candidate.id));
      await tx.delete(qualifiedLeads).where(eq(qualifiedLeads.scopeId, candidate.id));
      await tx.delete(humanConfirmations).where(eq(humanConfirmations.scopeId, candidate.id));
      await tx.delete(idempotencyRecords).where(eq(idempotencyRecords.scopeId, candidate.id));
      await tx.delete(quotes).where(eq(quotes.scopeId, candidate.id));
      await tx.delete(scopeAnswers).where(eq(scopeAnswers.scopeId, candidate.id));
      await tx.delete(scopeAssumptions).where(eq(scopeAssumptions.scopeId, candidate.id));
      await tx.delete(scopeParticipants).where(eq(scopeParticipants.scopeId, candidate.id));
      await tx.delete(scopeSessions).where(eq(scopeSessions.id, candidate.id));
      await tx.insert(auditEvents).values({
        workspaceId: scope.workspaceId,
        actor: "SYSTEM",
        action: "FINALIZED_SCOPE_RETENTION_DELETED",
        outcome: "SUCCEEDED",
        metadata: { deletedAt: now.toISOString() }
      });
    });
  }
}
