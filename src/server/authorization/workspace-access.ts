export class WorkspaceAccessDenied extends Error {
  constructor() {
    super("Resource not found");
  }
}

export type WorkspaceMembership = {
  workspaceId: string;
  role: "OWNER";
  status: "ACTIVE" | "DISABLED";
};

export function requireWorkspaceOwner(
  membership: WorkspaceMembership | null,
  workspaceId: string
): WorkspaceMembership {
  if (
    !membership ||
    membership.workspaceId !== workspaceId ||
    membership.status !== "ACTIVE" ||
    membership.role !== "OWNER"
  )
    throw new WorkspaceAccessDenied();
  return membership;
}
