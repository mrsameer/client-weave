import { eq } from "drizzle-orm";
import { createRuntimeDatabase } from "@/db/client";
import { workspaceMembers } from "@/db/schema/catalog";
import { createSupabaseServerClient } from "./supabase-server";

/** Returns the signed-in owner's workspace without exposing its existence to anonymous callers. */
export async function getOwnerWorkspace() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createRuntimeDatabase();
  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);
  return membership ?? null;
}
