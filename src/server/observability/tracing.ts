import { context, propagation, trace } from "@opentelemetry/api";

export function withRequestTrace<T>(
  name: string,
  headers: Headers,
  action: () => Promise<T>
): Promise<T> {
  const carrier = { traceparent: headers.get("traceparent") ?? "" };
  const parent = propagation.extract(context.active(), carrier);
  return context.with(parent, () =>
    trace.getTracer("clientweave").startActiveSpan(name, async (span) => {
      try {
        const result = await action();
        span.setStatus({ code: 1 });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2 });
        throw error;
      } finally {
        span.end();
      }
    })
  );
}
