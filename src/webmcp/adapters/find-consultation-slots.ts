import { requestAgentJson } from "./agent-request";

/** Read-only capability: listing availability never reserves or changes a slot. */
export function findConsultationSlots(limit = 10) {
  return requestAgentJson<{ timezone: string; slots: unknown[] }>(
    "find_consultation_slots",
    `/api/v1/scopes/current/availability?limit=${encodeURIComponent(String(limit))}`
  );
}
