export const auditActors = ["HUMAN", "AGENT", "IMPORTED", "SYSTEM"] as const;
export const auditOutcomes = ["SUCCEEDED", "REJECTED", "FAILED"] as const;
export type AuditActor = (typeof auditActors)[number];
export type AuditOutcome = (typeof auditOutcomes)[number];

export type AuditEvent = {
  workspaceId?: string;
  scopeId?: string;
  actor: AuditActor;
  action: string;
  outcome: AuditOutcome;
  metadata: Record<string, string | number | boolean | null>;
};

export function assertAuditEvent(event: AuditEvent): AuditEvent {
  if (!auditActors.includes(event.actor) || !auditOutcomes.includes(event.outcome))
    throw new TypeError("Invalid audit actor or outcome");
  if (!/^[A-Z][A-Z0-9_]{2,99}$/.test(event.action))
    throw new TypeError("Audit actions use a closed uppercase catalog");
  return event;
}
