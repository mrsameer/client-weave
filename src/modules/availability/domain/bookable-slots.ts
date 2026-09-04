export type AvailabilitySlot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: "AVAILABLE" | "BLOCKED" | "BOOKED";
  serviceIds?: string[];
};

export function findBookableSlots(
  slots: AvailabilitySlot[],
  serviceId: string,
  now = new Date(),
  limit = 10
): AvailabilitySlot[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 30)
    throw new RangeError("Slot limit must be between 1 and 30");
  return slots
    .filter(
      (slot) =>
        slot.status === "AVAILABLE" &&
        slot.startsAt > now &&
        (!slot.serviceIds || slot.serviceIds.includes(serviceId))
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, limit);
}
