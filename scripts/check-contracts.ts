import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderGeneratedTypeExports, renderJsonSchemas, renderOpenApi } from "./generate-contracts";

async function main() {
  const [contract, generatedTypes, generatedSchemas] = await Promise.all([
    readFile(resolve("specs/001-agent-service-cpq/contracts/openapi.yaml"), "utf8"),
    readFile(resolve("src/contracts/openapi/generated.ts"), "utf8"),
    readFile(resolve("src/contracts/openapi/json-schema.generated.json"), "utf8")
  ]);
  const required = [
    "discover_services",
    "create_scope",
    "update_scope",
    "price_scope",
    "find_consultation_slots",
    "finalize_confirmed_scope"
  ];
  for (const operation of required)
    if (!contract.includes(`operationId: ${operation}`))
      throw new Error(`OpenAPI is missing ${operation}`);
  if (contract.includes("operationId: human_confirmation"))
    throw new Error("Human confirmation must not be an agent operation");
  if (contract !== (await renderOpenApi()))
    throw new Error("Generated OpenAPI contract is stale; run pnpm contracts:generate");
  if (generatedTypes !== renderGeneratedTypeExports())
    throw new Error("Generated TypeScript contracts are stale; run pnpm contracts:generate");
  if (generatedSchemas !== renderJsonSchemas())
    throw new Error("Generated JSON Schema contracts are stale; run pnpm contracts:generate");
}
void main();
