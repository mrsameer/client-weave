import { and, asc, eq, gt, lt, ne } from "drizzle-orm";
import type { createRuntimeDatabase } from "@/db/client";
import { availabilitySlots } from "@/db/schema/finalization";

type Database = ReturnType<typeof createRuntimeDatabase>;

export class AvailabilityRepository {
  constructor(private readonly db: Database) {}
  async listBookable(workspaceId: string, after: Date, limit: number) {
    return this.db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.workspaceId, workspaceId),
          eq(availabilitySlots.status, "AVAILABLE"),
          gt(availabilitySlots.startsAt, after)
        )
      )
      .orderBy(asc(availabilitySlots.startsAt))
      .limit(limit);
  }

  async listOverlapping(workspaceId: string, startsAt: Date, endsAt: Date) {
    return this.db
      .select()
      .from(availabilitySlots)
      .where(
        and(
          eq(availabilitySlots.workspaceId, workspaceId),
          lt(availabilitySlots.startsAt, endsAt),
          gt(availabilitySlots.endsAt, startsAt)
        )
      );
  }

  async listForWorkspace(workspaceId: string) {
    return this.db
      .select()
      .from(availabilitySlots)
      .where(eq(availabilitySlots.workspaceId, workspaceId))
      .orderBy(asc(availabilitySlots.startsAt));
  }

  async create(input: { workspaceId: string; startsAt: Date; endsAt: Date }) {
    const [slot] = await this.db.insert(availabilitySlots).values(input).returning();
    if (!slot) throw new Error("Slot insert did not return a record");
    return slot;
  }

  async block(input: { workspaceId: string; slotId: string }) {
    const [slot] = await this.db
      .update(availabilitySlots)
      .set({ status: "BLOCKED" })
      .where(
        and(
          eq(availabilitySlots.workspaceId, input.workspaceId),
          eq(availabilitySlots.id, input.slotId),
          ne(availabilitySlots.status, "BOOKED")
        )
      )
      .returning({ id: availabilitySlots.id });
    if (!slot) throw new AvailabilityRepositoryError("SLOT_NOT_BLOCKABLE");
  }
}

export class AvailabilityRepositoryError extends Error {
  constructor(readonly code: "SLOT_NOT_BLOCKABLE") {
    super(code);
  }
}
