export type CapabilityDefinition = {
  name:
    | "discover_services"
    | "create_scope"
    | "update_scope"
    | "price_scope"
    | "find_consultation_slots"
    | "finalize_confirmed_scope";
  stateEffect: "READ_ONLY" | "DRAFT_MUTATION" | "DERIVED_RECORD_WRITE" | "CONSEQUENTIAL_WRITE";
  requiresHumanConfirmation: boolean;
};

export const capabilityRegistry: readonly CapabilityDefinition[] = [
  { name: "discover_services", stateEffect: "READ_ONLY", requiresHumanConfirmation: false },
  { name: "create_scope", stateEffect: "DRAFT_MUTATION", requiresHumanConfirmation: false },
  { name: "update_scope", stateEffect: "DRAFT_MUTATION", requiresHumanConfirmation: false },
  { name: "price_scope", stateEffect: "DERIVED_RECORD_WRITE", requiresHumanConfirmation: false },
  { name: "find_consultation_slots", stateEffect: "READ_ONLY", requiresHumanConfirmation: false },
  {
    name: "finalize_confirmed_scope",
    stateEffect: "CONSEQUENTIAL_WRITE",
    requiresHumanConfirmation: true
  }
] as const;

export function assertCapabilityRegistry(registry = capabilityRegistry): void {
  const expected = [
    "create_scope",
    "discover_services",
    "finalize_confirmed_scope",
    "find_consultation_slots",
    "price_scope",
    "update_scope"
  ];
  const actual = registry.map((entry) => entry.name).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index]))
    throw new Error("The agent registry must expose exactly the six contracted capabilities");
  if (registry.some((entry) => entry.name.includes("confirmation")))
    throw new Error("Human confirmation is not an agent capability");
  const effects: Record<CapabilityDefinition["name"], CapabilityDefinition["stateEffect"]> = {
    discover_services: "READ_ONLY",
    create_scope: "DRAFT_MUTATION",
    update_scope: "DRAFT_MUTATION",
    price_scope: "DERIVED_RECORD_WRITE",
    find_consultation_slots: "READ_ONLY",
    finalize_confirmed_scope: "CONSEQUENTIAL_WRITE"
  };
  for (const capability of registry) {
    if (capability.stateEffect !== effects[capability.name])
      throw new Error(`Invalid state effect for ${capability.name}`);
    if (capability.requiresHumanConfirmation !== (capability.name === "finalize_confirmed_scope"))
      throw new Error("Only finalization may require a prior human confirmation");
  }
}

assertCapabilityRegistry();
