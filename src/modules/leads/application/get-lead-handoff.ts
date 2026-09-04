export interface LeadHandoffReader<T> {
  getForWorkspace(workspaceId: string, leadId: string): Promise<T | null>;
}

/** A null result deliberately does not distinguish an absent lead from another workspace's lead. */
export function getLeadHandoff<T>(
  reader: LeadHandoffReader<T>,
  workspaceId: string,
  leadId: string
) {
  return reader.getForWorkspace(workspaceId, leadId);
}
