import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { toJSONSchema } from "zod";
import { parse, stringify } from "yaml";
import {
  capabilitiesSchema,
  createScopeRequestSchema,
  discoverServicesQuerySchema,
  finalizationRequestSchema,
  priceScopeRequestSchema,
  quoteResultSchema,
  serviceMatchSchema,
  scopeReviewSchema,
  updateScopeRequestSchema
} from "../src/contracts/schemas";

const openApiTemplate = resolve("specs/001-agent-service-cpq/contracts/openapi.template.yaml");
const openApiArtifact = resolve("specs/001-agent-service-cpq/contracts/openapi.yaml");

function generatedSchemas() {
  return {
    Capability: toJSONSchema(capabilitiesSchema.element),
    Capabilities: toJSONSchema(capabilitiesSchema),
    DiscoverServicesQuery: toJSONSchema(discoverServicesQuerySchema),
    ServiceMatch: toJSONSchema(serviceMatchSchema),
    CreateScopeRequest: toJSONSchema(createScopeRequestSchema),
    UpdateScopeRequest: toJSONSchema(updateScopeRequestSchema),
    PriceScopeRequest: toJSONSchema(priceScopeRequestSchema),
    FinalizationRequest: toJSONSchema(finalizationRequestSchema),
    QuoteResult: toJSONSchema(quoteResultSchema),
    ScopeReview: toJSONSchema(scopeReviewSchema)
  };
}

export function renderGeneratedTypeExports() {
  return `/** Generated from the authoritative Zod schemas. Do not edit manually. */
import type { z } from "zod";
import { capabilitySchema, capabilitiesSchema } from "../schemas/capabilities";
import { discoverServicesQuerySchema, serviceMatchSchema } from "../schemas/catalog";
import {
  createScopeRequestSchema,
  finalizationRequestSchema,
  priceScopeRequestSchema,
  updateScopeRequestSchema
} from "../schemas/scope";
import { quoteResultSchema, scopeReviewSchema } from "../schemas/review";

export type Capability = z.infer<typeof capabilitySchema>;
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export type DiscoverServicesQuery = z.infer<typeof discoverServicesQuerySchema>;
export type ServiceMatch = z.infer<typeof serviceMatchSchema>;
export type CreateScopeRequest = z.infer<typeof createScopeRequestSchema>;
export type UpdateScopeRequest = z.infer<typeof updateScopeRequestSchema>;
export type PriceScopeRequest = z.infer<typeof priceScopeRequestSchema>;
export type FinalizationRequest = z.infer<typeof finalizationRequestSchema>;
export type QuoteResult = z.infer<typeof quoteResultSchema>;
export type ScopeReview = z.infer<typeof scopeReviewSchema>;

export { capabilitySchema, capabilitiesSchema } from "../schemas/capabilities";
export { discoverServicesQuerySchema, serviceMatchSchema } from "../schemas/catalog";
export {
  createScopeRequestSchema,
  finalizationRequestSchema,
  priceScopeRequestSchema,
  updateScopeRequestSchema
} from "../schemas/scope";
export { quoteResultSchema, scopeReviewSchema } from "../schemas/review";
`;
}

export function renderJsonSchemas() {
  return `${JSON.stringify(
    {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      title: "ClientWeave generated contract schemas",
      definitions: {
        capabilities: toJSONSchema(capabilitiesSchema),
        discoverServicesQuery: toJSONSchema(discoverServicesQuerySchema),
        createScopeRequest: toJSONSchema(createScopeRequestSchema),
        updateScopeRequest: toJSONSchema(updateScopeRequestSchema),
        priceScopeRequest: toJSONSchema(priceScopeRequestSchema),
        finalizationRequest: toJSONSchema(finalizationRequestSchema),
        quoteResult: toJSONSchema(quoteResultSchema),
        scopeReview: toJSONSchema(scopeReviewSchema)
      }
    },
    null,
    2
  )}\n`;
}

/**
 * The template owns operation descriptions, security metadata, and agent state-effect
 * annotations. Every shared request/response component is overwritten from the
 * executable Zod schema so application and published contracts cannot silently drift.
 */
export async function renderOpenApi() {
  const document = parse(await readFile(openApiTemplate, "utf8")) as {
    info: { description?: string };
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, unknown> };
  };
  document.info.description =
    "Generated from OpenAPI operation metadata and authoritative executable Zod schemas. " +
    "Owner administration uses authenticated server actions and is described by the plan and data model.";
  document.paths["/scopes/current/quotes"] = {
    ...document.paths["/scopes/current/quotes"],
    post: {
      ...(document.paths["/scopes/current/quotes"]?.post as object),
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/PriceScopeRequest" } }
        }
      }
    }
  };
  document.paths["/scopes/current/finalizations"] = {
    ...document.paths["/scopes/current/finalizations"],
    post: {
      ...(document.paths["/scopes/current/finalizations"]?.post as object),
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/FinalizationRequest" } }
        }
      }
    }
  };
  document.components.schemas = { ...document.components.schemas, ...generatedSchemas() };
  return `# Generated by pnpm contracts:generate. Do not edit manually.\n${stringify(document)}`;
}

export async function generateContracts() {
  const openApi = await renderOpenApi();
  await Promise.all([
    writeFile(openApiArtifact, openApi),
    writeFile(resolve("src/contracts/openapi/generated.ts"), renderGeneratedTypeExports()),
    writeFile(resolve("src/contracts/openapi/json-schema.generated.json"), renderJsonSchemas())
  ]);
}
if (process.argv[1]?.endsWith("generate-contracts.ts")) void generateContracts();
