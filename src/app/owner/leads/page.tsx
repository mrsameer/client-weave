import Link from "next/link";
import { redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { LeadRepository } from "@/db/repositories/lead-repository";
import { listLeads } from "@/modules/leads/application/list-leads";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";

export const dynamic = "force-dynamic";

export default async function OwnerLeadsPage() {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const leads = await listLeads(new LeadRepository(createRuntimeDatabase()), owner.workspaceId);
  return (
    <main>
      <p className="eyebrow">Owner workspace</p>
      <h1>Qualified leads</h1>
      <ul>
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link href={`/owner/leads/${lead.id}`}>{lead.goal}</Link> —{" "}
            {(lead.quoteTotalMinor / 100).toLocaleString("en-US", {
              style: "currency",
              currency: "USD"
            })}
            {lead.bookingId ? " · booked" : ""}
          </li>
        ))}
      </ul>
    </main>
  );
}
