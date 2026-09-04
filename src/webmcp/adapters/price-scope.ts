import { requestAgentJson } from "./agent-request";

export function priceScope(expectedRevision: number) {
  return requestAgentJson("price_scope", "/api/v1/scopes/current/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision })
  });
}
