export type FinalSummaryModel = {
  hash: string;
  nonce: string;
  expiresAt: string;
  scopeRevision: number;
  quoteTotalMinor: number;
  action: "SUBMIT_LEAD" | "SUBMIT_LEAD_AND_BOOK";
  quoteId: string;
  slotId?: string;
  contact: { name?: string; email?: string };
  retentionNotice: string;
  scopeSnapshot: Record<string, unknown>;
  quoteSnapshot: { lineItems?: Array<{ label: string; amountMinor: number }> };
  serviceConstraints: unknown[];
};

export function FinalSummary({ summary }: { summary: FinalSummaryModel }) {
  return (
    <section>
      <h2>Final review</h2>
      <p>
        Action: <strong>{summary.action}</strong>
      </p>
      <p>
        Current quote:{" "}
        <strong>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
            summary.quoteTotalMinor / 100
          )}
        </strong>
      </p>
      <p>Contact: {summary.contact.name ?? summary.contact.email ?? "Not supplied"}</p>
      {summary.slotId ? <p>Selected consultation slot: {summary.slotId}</p> : null}
      <section>
        <h3>Quoted line items</h3>
        <ul>
          {(summary.quoteSnapshot.lineItems ?? []).map((line, index) => (
            <li key={`${line.label}-${index}`}>
              {line.label}:{" "}
              {(line.amountMinor / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD"
              })}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Scope reviewed</h3>
        <p>{String(summary.scopeSnapshot.goal ?? "Current attributed scope")}</p>
      </section>
      {summary.serviceConstraints.length ? (
        <p>Current service constraints are included in this review.</p>
      ) : null}
      <p>{summary.retentionNotice}</p>
      <p>
        <small>Review expires {new Date(summary.expiresAt).toLocaleTimeString()}.</small>
      </p>
    </section>
  );
}
