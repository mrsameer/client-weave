import { capabilityRegistry } from "./registry";

export type SanitizedInvocation = {
  capability: string;
  outcome: "SUCCEEDED" | "REJECTED" | "FAILED";
  reason: string;
  createdAt: Date;
};

export function capabilityInspector(invocations: SanitizedInvocation[] = []) {
  return capabilityRegistry.map((capability) => ({
    ...capability,
    recentInvocations: invocations
      .filter((invocation) => invocation.capability === capability.name)
      .slice(0, 5)
      .map(({ outcome, reason, createdAt }) => ({ outcome, reason, at: createdAt.toISOString() }))
  }));
}
