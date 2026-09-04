export type FieldDefinition = {
  key: string;
  type: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "MULTI_SELECT";
  required: boolean;
  choices?: string[];
  min?: number;
  max?: number;
};

export type NormalizedScope = {
  goal: string;
  budgetMaxMinor: number | null;
  targetDeliveryDate: string | null;
  assumptions: string[];
  answers: Record<string, string | number | boolean | string[] | null>;
};

export function normalizeScope(input: NormalizedScope): NormalizedScope {
  const goal = input.goal.normalize("NFKC").trim();
  if (!goal || goal.length > 1000)
    throw new RangeError("Goal must contain at most 1000 characters");
  const normalizedAssumptions = input.assumptions
    .map((value) => value.normalize("NFKC").trim())
    .filter(Boolean);
  if (normalizedAssumptions.some((value) => value.length > 500))
    throw new RangeError("Assumptions must contain at most 500 characters");
  const assumptions = [...new Set(normalizedAssumptions)];
  if (assumptions.length > 20) throw new RangeError("At most 20 assumptions are allowed");
  return {
    goal,
    budgetMaxMinor: input.budgetMaxMinor,
    targetDeliveryDate: input.targetDeliveryDate,
    assumptions,
    answers: Object.fromEntries(
      Object.entries(input.answers).sort(([a], [b]) => a.localeCompare(b))
    )
  };
}
