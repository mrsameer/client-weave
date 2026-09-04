type Activity = {
  id: string;
  actor: string;
  action: string;
  outcome: string;
  metadata: unknown;
  createdAt: Date;
};

export function ActionHistory({ events }: { events: Activity[] }) {
  return (
    <section>
      <h2>Activity</h2>
      <ol>
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.action}</strong> — {event.actor}, {event.outcome} at{" "}
            {event.createdAt.toLocaleString()}
          </li>
        ))}
      </ol>
    </section>
  );
}
