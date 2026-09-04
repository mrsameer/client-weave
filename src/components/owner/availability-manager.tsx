import { blockSlotAction, createSlotAction } from "@/app/owner/availability/actions";

type Slot = { id: string; startsAt: Date; endsAt: Date; status: string };

export function AvailabilityManager({ slots, timezone }: { slots: Slot[]; timezone: string }) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  });
  return (
    <section>
      <h1>Availability</h1>
      <p>All times are shown in {timezone}.</p>
      <form action={createSlotAction}>
        <label htmlFor="slot-start">Starts</label>
        <input id="slot-start" name="startsAt" type="datetime-local" required />
        <label htmlFor="slot-end">Ends</label>
        <input id="slot-end" name="endsAt" type="datetime-local" required />
        <button type="submit">Add available slot</button>
      </form>
      <ul>
        {slots.map((slot) => (
          <li key={slot.id}>
            {formatter.format(slot.startsAt)}–{formatter.format(slot.endsAt)}: {slot.status}
            {slot.status !== "BOOKED" ? (
              <form action={blockSlotAction}>
                <input type="hidden" name="slotId" value={slot.id} />
                <button type="submit">Block slot</button>
              </form>
            ) : (
              <span> Booked slots are retained as history.</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
