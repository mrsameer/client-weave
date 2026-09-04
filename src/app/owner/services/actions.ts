"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { ConfigurationRepository } from "@/db/repositories/configuration-repository";
import { publishService, setServiceActive } from "@/modules/catalog/application/manage-services";
import type { ServiceConfiguration } from "@/modules/catalog/domain/service-configuration";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";

export type PublishServiceState = { error?: string; serviceId?: string; version?: number };

export async function publishServiceAction(
  _previous: PublishServiceState,
  formData: FormData
): Promise<PublishServiceState> {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  const raw = String(formData.get("configuration") ?? "");
  let configuration: ServiceConfiguration;
  try {
    configuration = JSON.parse(raw) as ServiceConfiguration;
  } catch {
    return { error: "Configuration must be valid JSON." };
  }
  const result = await publishService(new ConfigurationRepository(createRuntimeDatabase()), {
    workspaceId: owner.workspaceId,
    slug: String(formData.get("slug") ?? ""),
    configuration,
    ...(formData.get("serviceId") ? { serviceId: String(formData.get("serviceId")) } : {})
  });
  if (!result.ok) return { error: result.issues.map((issue) => issue.message).join(" ") };
  revalidatePath("/owner/services");
  return { serviceId: result.service.serviceId, version: result.service.version };
}

export async function setServiceActiveAction(formData: FormData) {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  await setServiceActive(new ConfigurationRepository(createRuntimeDatabase()), {
    workspaceId: owner.workspaceId,
    serviceId: String(formData.get("serviceId") ?? ""),
    active: formData.get("active") === "true"
  });
  revalidatePath("/owner/services");
}
