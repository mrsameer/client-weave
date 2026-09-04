import { ActionHistory } from "./action-history";

type Handoff = {
  id: string;
  contact: unknown;
  createdAt: Date;
  scopeRef: string;
  scopeRevision: number;
  goal: string;
  goalActor: string;
  budgetMaxMinor: number | null;
  budgetActor: string;
  targetDeliveryDate: Date | null;
  deliveryActor: string;
  quoteId: string;
  quoteTotalMinor: number;
  quoteSnapshot: unknown;
  bookingId: string | null;
  slotStartsAt: Date | null;
  slotEndsAt: Date | null;
  assumptions: Array<{ value: string; actor: string; updatedAt: Date }>;
  answers: Array<{ field: string; value: unknown; actor: string; updatedAt: Date }>;
  activity: Array<{
    id: string;
    actor: string;
    action: string;
    outcome: string;
    metadata: unknown;
    createdAt: Date;
  }>;
};

export function LeadHandoff({ lead }: { lead: Handoff }) {
  const contact = lead.contact as { name?: string; email?: string };
  return (
    <main>
      <p className="eyebrow">Qualified lead {lead.scopeRef}</p>
      <h1>{lead.goal}</h1>
      <section>
        <h2>Contact</h2>
        <p>{contact.name ?? "No name provided"}</p>
        <p>{contact.email ?? "No email provided"}</p>
      </section>
      <section>
        <h2>Confirmed scope</h2>
        <p>
          Revision {lead.scopeRevision}; goal supplied by {lead.goalActor}.
        </p>
        <p>
          Budget {lead.budgetMaxMinor ?? "not supplied"} minor units, supplied by {lead.budgetActor}
          .
        </p>
        <p>
          Target delivery: {lead.targetDeliveryDate?.toLocaleDateString() ?? "not supplied"} (
          {lead.deliveryActor})
        </p>
        <h3>Assumptions</h3>
        <ul>
          {lead.assumptions.map((assumption) => (
            <li key={`${assumption.value}-${assumption.updatedAt.toISOString()}`}>
              {assumption.value} ({assumption.actor})
            </li>
          ))}
        </ul>
        <h3>Answers</h3>
        <ul>
          {lead.answers.map((answer) => (
            <li key={answer.field}>
              {answer.field}: {String(answer.value)} ({answer.actor})
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Quote</h2>
        <p>
          Total:{" "}
          {(lead.quoteTotalMinor / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD"
          })}
        </p>
        <p>Immutable quote ID: {lead.quoteId}</p>
        <pre>{JSON.stringify(lead.quoteSnapshot, null, 2)}</pre>
      </section>
      <section>
        <h2>Booking</h2>
        {lead.bookingId && lead.slotStartsAt ? (
          <p>
            {lead.slotStartsAt.toLocaleString()}–{lead.slotEndsAt?.toLocaleTimeString()}
          </p>
        ) : (
          <p>No consultation booking.</p>
        )}
      </section>
      <ActionHistory events={lead.activity} />
    </main>
  );
}
