import type { AuditEvent } from "../domain/audit-event";
import { assertAuditEvent } from "../domain/audit-event";

export interface AuditEventWriter {
  append(event: AuditEvent): Promise<void>;
}

export async function appendAuditEvent(writer: AuditEventWriter, event: AuditEvent): Promise<void> {
  await writer.append(assertAuditEvent(event));
}
