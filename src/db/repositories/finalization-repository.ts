import { and, eq, gt, isNull } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { auditEvents } from "@/db/schema/audit";
import { quotes, scopeSessions } from "@/db/schema/scopes";
import {
  availabilitySlots,
  bookings,
  humanConfirmations,
  idempotencyRecords,
  qualifiedLeads
} from "@/db/schema/finalization";

type Database = ReturnType<typeof createRuntimeDatabase>;

export class FinalizationRepository {
  constructor(private readonly db: Database) {}
  async recordConfirmation(input: {
    scopeId: string;
    scopeRevision: number;
    summaryHash: string;
    expiresAt: Date;
  }) {
    const [confirmation] = await this.db
      .insert(humanConfirmations)
      .values(input)
      .returning({ id: humanConfirmations.id });
    if (!confirmation) throw new Error("Confirmation insert did not return a record");
    return confirmation;
  }

  /**
   * Creates all consequential records in one transaction.  The idempotency record
   * is inserted before any write, so a retry receives the exact stored response
   * and a competing request cannot create a second lead or booking.
   */
  async finalize(input: {
    scopeId: string;
    workspaceId: string;
    scopeRevision: number;
    quoteId: string;
    summaryHash: string;
    action: "SUBMIT_LEAD" | "SUBMIT_LEAD_AND_BOOK";
    slotId?: string;
    contact: { name?: string; email?: string };
    idempotencyKey: string;
    requestHash: string;
  }): Promise<
    | { kind: "completed"; response: FinalizationResult }
    | { kind: "replayed"; response: FinalizationResult }
    | { kind: "rejected"; code: FinalizationRejection }
  > {
    if (input.action === "SUBMIT_LEAD_AND_BOOK" && !input.slotId)
      return { kind: "rejected", code: "SLOT_REQUIRED" };
    return this.db.transaction(async (tx) => {
      // A completed retry must replay even though the scope is now finalized. This
      // read takes no parent-row lock; only a new write attempt proceeds to the
      // fixed scope-first lock sequence below.
      const [priorRequest] = await tx
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.scopeId, input.scopeId),
            eq(idempotencyRecords.key, input.idempotencyKey)
          )
        );
      if (priorRequest) {
        if (priorRequest.requestHash !== input.requestHash)
          return { kind: "rejected", code: "IDEMPOTENCY_KEY_REUSED" };
        if (!priorRequest.response) return { kind: "rejected", code: "FINALIZATION_IN_PROGRESS" };
        return { kind: "replayed", response: priorRequest.response as FinalizationResult };
      }

      const now = new Date();
      const [currentScope] = await tx
        .select({ id: scopeSessions.id })
        .from(scopeSessions)
        .where(
          and(
            eq(scopeSessions.id, input.scopeId),
            eq(scopeSessions.revision, input.scopeRevision),
            isNull(scopeSessions.finalizedAt),
            gt(scopeSessions.expiresAt, now)
          )
        )
        // All finalization attempts acquire rows in this order. It prevents an
        // inverse lock order when a scope is finalized concurrently.
        .for("update");
      if (!currentScope) throw new FinalizationTransactionError("SCOPE_STALE");

      // Claim only after locking the parent scope. Inserting this child row first
      // obtains a PostgreSQL key-share lock through its foreign key, which prevents
      // concurrent contenders from acquiring the scope update lock.
      const [claim] = await tx
        .insert(idempotencyRecords)
        .values({
          scopeId: input.scopeId,
          key: input.idempotencyKey,
          requestHash: input.requestHash
        })
        .onConflictDoNothing()
        .returning({ id: idempotencyRecords.id });
      if (!claim) {
        const [existing] = await tx
          .select()
          .from(idempotencyRecords)
          .where(
            and(
              eq(idempotencyRecords.scopeId, input.scopeId),
              eq(idempotencyRecords.key, input.idempotencyKey)
            )
          );
        if (!existing || existing.requestHash !== input.requestHash)
          return { kind: "rejected", code: "IDEMPOTENCY_KEY_REUSED" };
        if (!existing.response) return { kind: "rejected", code: "FINALIZATION_IN_PROGRESS" };
        return { kind: "replayed", response: existing.response as FinalizationResult };
      }

      const [currentQuote] = await tx
        .select({ id: quotes.id })
        .from(quotes)
        .where(
          and(
            eq(quotes.id, input.quoteId),
            eq(quotes.scopeId, input.scopeId),
            eq(quotes.scopeRevision, input.scopeRevision)
          )
        )
        .for("update");
      if (!currentQuote) throw new FinalizationTransactionError("QUOTE_STALE");
      const [confirmation] = await tx
        .select({ id: humanConfirmations.id })
        .from(humanConfirmations)
        .where(
          and(
            eq(humanConfirmations.scopeId, input.scopeId),
            eq(humanConfirmations.scopeRevision, input.scopeRevision),
            eq(humanConfirmations.summaryHash, input.summaryHash),
            gt(humanConfirmations.expiresAt, now),
            isNull(humanConfirmations.invalidatedAt)
          )
        )
        .for("update");
      if (!confirmation) throw new FinalizationTransactionError("CONFIRMATION_STALE");

      let lockedSlot: { id: string } | undefined;
      if (input.action === "SUBMIT_LEAD_AND_BOOK") {
        const slotId = input.slotId;
        if (!slotId) throw new Error("Booking action requires a slot");
        [lockedSlot] = await tx
          .select({ id: availabilitySlots.id })
          .from(availabilitySlots)
          .where(
            and(
              eq(availabilitySlots.id, slotId),
              eq(availabilitySlots.workspaceId, input.workspaceId),
              eq(availabilitySlots.status, "AVAILABLE")
            )
          )
          .for("update");
        if (!lockedSlot) throw new FinalizationTransactionError("SLOT_UNAVAILABLE");
      }

      const [lead] = await tx
        .insert(qualifiedLeads)
        .values({ scopeId: input.scopeId, quoteId: input.quoteId, contact: input.contact })
        .returning({ id: qualifiedLeads.id });
      if (!lead) throw new Error("Lead insert did not return a record");

      let bookingId: string | undefined;
      if (input.action === "SUBMIT_LEAD_AND_BOOK") {
        const [slot] = await tx
          .update(availabilitySlots)
          .set({ status: "BOOKED" })
          .where(
            and(
              eq(availabilitySlots.id, lockedSlot!.id),
              eq(availabilitySlots.workspaceId, input.workspaceId),
              eq(availabilitySlots.status, "AVAILABLE")
            )
          )
          .returning({ id: availabilitySlots.id });
        if (!slot) throw new FinalizationTransactionError("SLOT_UNAVAILABLE");
        const [booking] = await tx
          .insert(bookings)
          .values({ scopeId: input.scopeId, slotId: slot.id, leadId: lead.id })
          .returning({ id: bookings.id });
        if (!booking) throw new Error("Booking insert did not return a record");
        bookingId = booking.id;
      }

      const [finalizedScope] = await tx
        .update(scopeSessions)
        .set({ finalizedAt: now, updatedAt: now })
        .where(
          and(
            eq(scopeSessions.id, input.scopeId),
            eq(scopeSessions.revision, input.scopeRevision),
            isNull(scopeSessions.finalizedAt)
          )
        )
        .returning({ id: scopeSessions.id });
      if (!finalizedScope) throw new FinalizationTransactionError("SCOPE_STALE");
      const response: FinalizationResult = {
        leadId: lead.id,
        ...(bookingId === undefined ? {} : { bookingId }),
        finalizedAt: now.toISOString()
      };
      await tx
        .update(idempotencyRecords)
        .set({ response })
        .where(eq(idempotencyRecords.id, claim.id));
      await tx.insert(auditEvents).values({
        workspaceId: input.workspaceId,
        scopeId: input.scopeId,
        actor: "HUMAN",
        action: "SCOPE_FINALIZED",
        outcome: "SUCCEEDED",
        metadata: { quoteId: input.quoteId, ...(bookingId ? { bookingId } : {}) }
      });
      return { kind: "completed", response };
    });
  }
}

export type FinalizationResult = { leadId: string; bookingId?: string; finalizedAt: string };
export type FinalizationRejection =
  "CONFIRMATION_STALE" | "SLOT_REQUIRED" | "IDEMPOTENCY_KEY_REUSED" | "FINALIZATION_IN_PROGRESS";

export class FinalizationTransactionError extends Error {
  constructor(
    readonly code: "SLOT_UNAVAILABLE" | "CONFIRMATION_STALE" | "SCOPE_STALE" | "QUOTE_STALE"
  ) {
    super(code);
  }
}
