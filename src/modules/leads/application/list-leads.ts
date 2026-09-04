export interface LeadListReader<T> {
  listForWorkspace(workspaceId: string): Promise<T[]>;
}

export function listLeads<T>(reader: LeadListReader<T>, workspaceId: string) {
  return reader.listForWorkspace(workspaceId);
}
