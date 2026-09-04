import Link from "next/link";
import { redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { ConfigurationRepository } from "@/db/repositories/configuration-repository";
import { ServiceEditor } from "@/components/owner/service-editor";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";
import { setServiceActiveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerServicesPage() {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const services = await new ConfigurationRepository(createRuntimeDatabase()).listForWorkspace(
    owner.workspaceId
  );
  return (
    <main>
      <p className="eyebrow">Owner workspace</p>
      <h1>Services</h1>
      <ul>
        {services.map((service) => (
          <li key={service.id}>
            <Link href={`/owner/services/${service.id}`}>{service.slug}</Link> —{" "}
            {service.active ? "active" : "inactive"}
            <form action={setServiceActiveAction}>
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="active" value={String(!service.active)} />
              <button type="submit">{service.active ? "Deactivate" : "Activate"}</button>
            </form>
          </li>
        ))}
      </ul>
      <h2>Publish a service</h2>
      <ServiceEditor />
    </main>
  );
}
