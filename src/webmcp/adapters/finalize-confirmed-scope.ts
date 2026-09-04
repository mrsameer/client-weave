import { requestAgentJson } from "./agent-request";

export function finalizeConfirmedScope(input: {
  summaryHash: string;
  nonce: string;
  contact: { name?: string; email?: string };
  action: "SUBMIT_LEAD" | "SUBMIT_LEAD_AND_BOOK";
  slotId?: string;
  idempotencyKey: string;
}) {
  return requestAgentJson("finalize_confirmed_scope", "/api/v1/scopes/current/finalizations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": input.idempotencyKey
    },
    body: JSON.stringify({
      summaryHash: input.summaryHash,
      nonce: input.nonce,
      contact: input.contact,
      action: input.action,
      ...(input.slotId ? { slotId: input.slotId } : {})
    })
  });
}
