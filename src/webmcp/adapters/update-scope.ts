import { requestAgentJson } from "./agent-request";

export function updateScope(input: {
  expectedRevision: number;
  goal?: string;
  budgetMaxMinor?: number | null;
  targetDeliveryDate?: string | null;
  assumptions?: string[];
  answers?: Record<string, unknown>;
}) {
  const { expectedRevision, ...patch } = input;
  return requestAgentJson("update_scope", "/api/v1/scopes/current", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "if-match": `"${expectedRevision}"`
    },
    body: JSON.stringify(patch)
  });
}
