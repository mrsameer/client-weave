import { notFound, redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { ConfigurationRepository } from "@/db/repositories/configuration-repository";
import { ServiceEditor } from "@/components/owner/service-editor";
import { VersionHistory } from "@/components/owner/version-history";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";

export const dynamic = "force-dynamic";

export default async function OwnerServicePage({
  params
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const { serviceId } = await params;
  const repository = new ConfigurationRepository(createRuntimeDatabase());
  const service = (await repository.listForWorkspace(owner.workspaceId)).find(
    (item) => item.id === serviceId
  );
  if (!service) notFound();
  const [versions, configuration] = await Promise.all([
    repository.versionHistory(owner.workspaceId, service.id),
    repository.activeConfiguration(owner.workspaceId, service.id)
  ]);
  return (
    <main>
      <p className="eyebrow">Editing {service.slug}</p>
      <h1>Publish a new immutable version</h1>
      <ServiceEditor
        serviceId={service.id}
        slug={service.slug}
        {...(configuration ? { initialConfiguration: configuration } : {})}
      />
      <VersionHistory versions={versions} />
    </main>
  );
}
