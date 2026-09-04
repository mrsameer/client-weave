export type OwnerSlot = { id: string; startsAt: Date; endsAt: Date; status: string };

export interface AvailabilityManagerStore {
  listOverlapping(workspaceId: string, startsAt: Date, endsAt: Date): Promise<OwnerSlot[]>;
  create(input: { workspaceId: string; startsAt: Date; endsAt: Date }): Promise<OwnerSlot>;
  block(input: { workspaceId: string; slotId: string }): Promise<void>;
}

export async function createAvailabilitySlot(
  store: AvailabilityManagerStore,
  input: { workspaceId: string; startsAt: Date; endsAt: Date }
) {
  if (!Number.isFinite(input.startsAt.getTime()) || !Number.isFinite(input.endsAt.getTime()))
    throw new TypeError("Slot times must be valid timestamps");
  if (input.startsAt >= input.endsAt) throw new RangeError("A slot must end after it starts");
  if (input.startsAt <= new Date()) throw new RangeError("A slot must be in the future");
  const clashes = await store.listOverlapping(input.workspaceId, input.startsAt, input.endsAt);
  if (clashes.length) throw new AvailabilityManagementError("SLOT_OVERLAP");
  return store.create(input);
}

export async function blockAvailabilitySlot(
  store: AvailabilityManagerStore,
  input: { workspaceId: string; slotId: string }
) {
  await store.block(input);
}

export class AvailabilityManagementError extends Error {
  constructor(readonly code: "SLOT_OVERLAP") {
    super(code);
  }
}
