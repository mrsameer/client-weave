export type QuotePanelModel = {
  status: "INCOMPLETE" | "CONFLICTED" | "CURRENT" | "STALE";
  eligible: boolean;
  currency?: string;
  minimumTotalMinor?: number;
  maximumTotalMinor?: number;
  lineItems: Array<{ label: string; amountMinor: number }>;
  issues: Array<{ field: string; message: string; severity: "MISSING" | "CONFLICT" }>;
};

export function QuotePanel({ quote }: { quote: QuotePanelModel | null }) {
  if (!quote)
    return (
      <section aria-label="Quote">
        <h2>Quote</h2>
        <p>No current quote yet.</p>
      </section>
    );
  if (!quote.eligible)
    return (
      <section aria-label="Quote">
        <h2>{quote.status === "CONFLICTED" ? "Resolve scope conflicts" : "Complete the scope"}</h2>
        <p role="status">A final price is unavailable until the listed issues are resolved.</p>
        <ul>
          {quote.issues.map((issue) => (
            <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      </section>
    );
  const totalMinor = quote.maximumTotalMinor ?? quote.minimumTotalMinor ?? 0;
  return (
    <section aria-label="Quote">
      <h2>Current planning range</h2>
      <p>
        <strong>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
            totalMinor / 100
          )}
        </strong>
      </p>
      <ul>
        {quote.lineItems.map((line) => (
          <li key={line.label}>
            {line.label}:{" "}
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              line.amountMinor / 100
            )}
          </li>
        ))}
      </ul>
      <p>This is a non-binding planning range based on current seller rules.</p>
    </section>
  );
}
