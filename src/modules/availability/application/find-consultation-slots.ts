import { findBookableSlots, type AvailabilitySlot } from "../domain/bookable-slots";

export interface SlotReader {
  listBookable(workspaceId: string, after: Date, limit: number): Promise<AvailabilitySlot[]>;
}

export type ConsultationSlotRequest = {
  workspaceId: string;
  serviceId: string;
  quoteCurrent: boolean;
  limit?: number;
  now?: Date;
};

export async function findConsultationSlots(reader: SlotReader, input: ConsultationSlotRequest) {
  if (!input.quoteCurrent) throw new ConsultationSlotsUnavailableError("QUOTE_STALE");
  const limit = input.limit ?? 10;
  const now = input.now ?? new Date();
  return findBookableSlots(
    await reader.listBookable(input.workspaceId, now, limit),
    input.serviceId,
    now,
    limit
  );
}

export class ConsultationSlotsUnavailableError extends Error {
  constructor(readonly code: "QUOTE_STALE") {
    super(code);
  }
}
