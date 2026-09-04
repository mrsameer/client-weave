import { requestAgentJson } from "./agent-request";

export function discoverServices(input: {
  need: string;
  budgetMaxMinor?: number;
  desiredDeliveryDate?: string;
}) {
  const query = new URLSearchParams({
    need: input.need,
    ...(input.budgetMaxMinor === undefined ? {} : { budgetMaxMinor: String(input.budgetMaxMinor) }),
    ...(input.desiredDeliveryDate === undefined
      ? {}
      : { desiredDeliveryDate: input.desiredDeliveryDate })
  });
  return requestAgentJson<{ services: unknown[] }>(
    "discover_services",
    `/api/v1/services?${query}`
  );
}
