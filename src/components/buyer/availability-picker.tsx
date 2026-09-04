"use client";

import { useState } from "react";

type Slot = { id: string; startsAt: string; endsAt: string };

export function AvailabilityPicker({ onSelect }: { onSelect(slotId: string): void }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState("Load a current quote to view consultation availability.");
  async function refresh() {
    setMessage("Loading available consultations…");
    const response = await fetch("/api/v1/scopes/current/availability");
    const body = await response.json();
    if (!response.ok) return setMessage(body.detail ?? "Availability is unavailable.");
    setSlots(body.slots);
    setMessage(
      body.slots.length
        ? "Choose a time; this does not reserve it."
        : "No consultation slots are currently available. Refresh to check again."
    );
  }
  return (
    <section aria-label="Consultation availability">
      <h2>Consultation availability</h2>
      <p aria-live="polite">{message}</p>
      <button type="button" onClick={refresh}>
        Refresh slots
      </button>
      <ul>
        {slots.map((slot) => (
          <li key={slot.id}>
            <button type="button" onClick={() => onSelect(slot.id)}>
              {new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/New_York"
              }).format(new Date(slot.startsAt))}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
