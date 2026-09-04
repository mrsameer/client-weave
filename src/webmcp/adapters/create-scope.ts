import { requestAgentJson } from "./agent-request";

export function createScope(input: {
  serviceSlug: string;
  goal: string;
  budgetMaxMinor?: number;
  targetDeliveryDate?: string;
  assumptions?: string[];
  answers?: Record<string, unknown>;
}) {
  return requestAgentJson("create_scope", "/api/v1/scopes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assumptions: [], answers: {}, ...input })
  });
}
