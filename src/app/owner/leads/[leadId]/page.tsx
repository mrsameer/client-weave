import { notFound, redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { LeadRepository } from "@/db/repositories/lead-repository";
import { LeadHandoff } from "@/components/owner/lead-handoff";
import { getLeadHandoff } from "@/modules/leads/application/get-lead-handoff";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";

export const dynamic = "force-dynamic";

export default async function OwnerLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const { leadId } = await params;
  const lead = await getLeadHandoff(
    new LeadRepository(createRuntimeDatabase()),
    owner.workspaceId,
    leadId
  );
  if (!lead) notFound();
  return <LeadHandoff lead={lead} />;
}
