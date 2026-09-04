import type { NextRequest } from "next/server";
import { AgentInvocationRepository } from "@/db/repositories/agent-invocation-repository";
import type { createRuntimeDatabase } from "@/db/client";
import { capabilityRegistry, type CapabilityDefinition } from "./registry";

type Database = ReturnType<typeof createRuntimeDatabase>;

export function requestedCapability(request: NextRequest, expected: CapabilityDefinition["name"]) {
  return request.headers.get("x-clientweave-capability") === expected;
}

export async function recordCapabilityInvocation(input: {
  db: Database;
  request: NextRequest;
  scopeId: string;
  capability: CapabilityDefinition["name"];
  outcome: "SUCCEEDED" | "REJECTED" | "FAILED";
  reason: string;
}) {
  if (!requestedCapability(input.request, input.capability)) return;
  const definition = capabilityRegistry.find((entry) => entry.name === input.capability);
  if (!definition) return;
  await new AgentInvocationRepository(input.db).append({
    scopeId: input.scopeId,
    capability: definition.name,
    stateEffect: definition.stateEffect,
    outcome: input.outcome,
    reason: input.reason
  });
}
