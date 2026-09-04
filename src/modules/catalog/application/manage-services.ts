import {
  validateServiceConfiguration,
  type ServiceConfiguration
} from "../domain/service-configuration";

export interface ServiceConfigurationWriter {
  publish(input: {
    workspaceId: string;
    slug: string;
    configuration: ServiceConfiguration;
    serviceId?: string;
    activate?: boolean;
  }): Promise<{ serviceId: string; versionId: string; version: number }>;
  setActive(input: { workspaceId: string; serviceId: string; active: boolean }): Promise<void>;
}

export async function publishService(
  writer: ServiceConfigurationWriter,
  input: {
    workspaceId: string;
    slug: string;
    configuration: ServiceConfiguration;
    serviceId?: string;
    activate?: boolean;
  }
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
    return {
      ok: false as const,
      issues: [{ field: "slug", message: "Use a lowercase URL slug." }]
    };
  const issues = validateServiceConfiguration(input.configuration);
  if (issues.length) return { ok: false as const, issues };
  return { ok: true as const, service: await writer.publish(input) };
}

export async function setServiceActive(
  writer: ServiceConfigurationWriter,
  input: { workspaceId: string; serviceId: string; active: boolean }
) {
  await writer.setActive(input);
}
