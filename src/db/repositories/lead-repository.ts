import { and, asc, desc, eq } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { auditEvents } from "@/db/schema/audit";
import { serviceOfferings } from "@/db/schema/catalog";
import { availabilitySlots, bookings, qualifiedLeads } from "@/db/schema/finalization";
import { quotes, scopeAnswers, scopeAssumptions, scopeSessions } from "@/db/schema/scopes";

type Database = ReturnType<typeof createRuntimeDatabase>;

export class LeadRepository {
  constructor(private readonly db: Database) {}

  async listForWorkspace(workspaceId: string) {
    return this.db
      .select({
        id: qualifiedLeads.id,
        scopeRef: scopeSessions.ref,
        goal: scopeSessions.goal,
        quoteTotalMinor: quotes.totalMinor,
        createdAt: qualifiedLeads.createdAt,
        bookingId: bookings.id
      })
      .from(qualifiedLeads)
      .innerJoin(scopeSessions, eq(qualifiedLeads.scopeId, scopeSessions.id))
      .innerJoin(serviceOfferings, eq(scopeSessions.serviceId, serviceOfferings.id))
      .innerJoin(quotes, eq(qualifiedLeads.quoteId, quotes.id))
      .leftJoin(bookings, eq(bookings.leadId, qualifiedLeads.id))
      .where(eq(serviceOfferings.workspaceId, workspaceId))
      .orderBy(desc(qualifiedLeads.createdAt));
  }

  async getForWorkspace(workspaceId: string, leadId: string) {
    const [lead] = await this.db
      .select({
        id: qualifiedLeads.id,
        contact: qualifiedLeads.contact,
        createdAt: qualifiedLeads.createdAt,
        scopeId: scopeSessions.id,
        scopeRef: scopeSessions.ref,
        scopeRevision: scopeSessions.revision,
        goal: scopeSessions.goal,
        goalActor: scopeSessions.goalActor,
        budgetMaxMinor: scopeSessions.budgetMaxMinor,
        budgetActor: scopeSessions.budgetActor,
        targetDeliveryDate: scopeSessions.targetDeliveryDate,
        deliveryActor: scopeSessions.deliveryActor,
        quoteId: quotes.id,
        quoteTotalMinor: quotes.totalMinor,
        quoteSnapshot: quotes.snapshot,
        bookingId: bookings.id,
        slotStartsAt: availabilitySlots.startsAt,
        slotEndsAt: availabilitySlots.endsAt
      })
      .from(qualifiedLeads)
      .innerJoin(scopeSessions, eq(qualifiedLeads.scopeId, scopeSessions.id))
      .innerJoin(serviceOfferings, eq(scopeSessions.serviceId, serviceOfferings.id))
      .innerJoin(quotes, eq(qualifiedLeads.quoteId, quotes.id))
      .leftJoin(bookings, eq(bookings.leadId, qualifiedLeads.id))
      .leftJoin(availabilitySlots, eq(bookings.slotId, availabilitySlots.id))
      .where(and(eq(qualifiedLeads.id, leadId), eq(serviceOfferings.workspaceId, workspaceId)));
    if (!lead) return null;
    const [activity, assumptions, answers] = await Promise.all([
      this.db
        .select({
          id: auditEvents.id,
          actor: auditEvents.actor,
          action: auditEvents.action,
          outcome: auditEvents.outcome,
          metadata: auditEvents.metadata,
          createdAt: auditEvents.createdAt
        })
        .from(auditEvents)
        .where(eq(auditEvents.scopeId, lead.scopeId))
        .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id)),
      this.db
        .select({
          value: scopeAssumptions.value,
          actor: scopeAssumptions.actor,
          updatedAt: scopeAssumptions.updatedAt
        })
        .from(scopeAssumptions)
        .where(eq(scopeAssumptions.scopeId, lead.scopeId))
        .orderBy(asc(scopeAssumptions.displayOrder)),
      this.db
        .select({
          field: scopeAnswers.fieldKey,
          value: scopeAnswers.value,
          actor: scopeAnswers.actor,
          updatedAt: scopeAnswers.updatedAt
        })
        .from(scopeAnswers)
        .where(eq(scopeAnswers.scopeId, lead.scopeId))
    ]);
    return { ...lead, activity, assumptions, answers };
  }
}
