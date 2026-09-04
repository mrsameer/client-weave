import { redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { AvailabilityRepository } from "@/db/repositories/availability-repository";
import { AvailabilityManager } from "@/components/owner/availability-manager";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";
import { workspaces } from "@/db/schema/catalog";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function OwnerAvailabilityPage() {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const db = createRuntimeDatabase();
  const [[workspace], slots] = await Promise.all([
    db
      .select({ timezone: workspaces.timezone })
      .from(workspaces)
      .where(eq(workspaces.id, owner.workspaceId)),
    new AvailabilityRepository(db).listForWorkspace(owner.workspaceId)
  ]);
  if (!workspace) redirect("/owner/login");
  return <AvailabilityManager slots={slots} timezone={workspace.timezone} />;
}
