import type { FieldDefinition, NormalizedScope } from "./normalize-scope";

export type ScopeIssue = {
  code: string;
  field: string;
  message: string;
  severity: "MISSING" | "CONFLICT";
};
export type Constraint = {
  field: string;
  incompatibleWith?: { field: string; equals: string | number | boolean };
  message: string;
};

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validateScope(
  scope: NormalizedScope,
  fields: FieldDefinition[],
  constraints: Constraint[] = []
): ScopeIssue[] {
  const issues: ScopeIssue[] = [];
  for (const definition of [...fields].sort((a, b) => a.key.localeCompare(b.key))) {
    const value = scope.answers[definition.key];
    if (definition.required && isEmpty(value)) {
      issues.push({
        code: "REQUIRED",
        field: definition.key,
        message: `${definition.key} is required.`,
        severity: "MISSING"
      });
      continue;
    }
    if (isEmpty(value)) continue;
    const validType =
      definition.type === "TEXT" || definition.type === "SELECT"
        ? typeof value === "string"
        : definition.type === "NUMBER"
          ? typeof value === "number"
          : definition.type === "BOOLEAN"
            ? typeof value === "boolean"
            : Array.isArray(value);
    if (!validType)
      issues.push({
        code: "INVALID_TYPE",
        field: definition.key,
        message: `${definition.key} has an invalid type.`,
        severity: "CONFLICT"
      });
    if (
      typeof value === "number" &&
      ((definition.min !== undefined && value < definition.min) ||
        (definition.max !== undefined && value > definition.max))
    )
      issues.push({
        code: "OUT_OF_RANGE",
        field: definition.key,
        message: `${definition.key} is outside the allowed range.`,
        severity: "CONFLICT"
      });
    if (definition.choices && typeof value === "string" && !definition.choices.includes(value))
      issues.push({
        code: "UNSUPPORTED_OPTION",
        field: definition.key,
        message: `${definition.key} is not a supported option.`,
        severity: "CONFLICT"
      });
    if (
      definition.choices &&
      Array.isArray(value) &&
      value.some((choice) => !definition.choices?.includes(choice))
    )
      issues.push({
        code: "UNSUPPORTED_OPTION",
        field: definition.key,
        message: `${definition.key} contains an unsupported option.`,
        severity: "CONFLICT"
      });
  }
  for (const constraint of constraints) {
    const own = scope.answers[constraint.field];
    const conflict = constraint.incompatibleWith;
    if (!isEmpty(own) && conflict && scope.answers[conflict.field] === conflict.equals)
      issues.push({
        code: "INCOMPATIBLE_OPTIONS",
        field: constraint.field,
        message: constraint.message,
        severity: "CONFLICT"
      });
  }
  return issues.sort(
    (a, b) =>
      Number(a.severity === "CONFLICT") - Number(b.severity === "CONFLICT") ||
      a.field.localeCompare(b.field) ||
      a.code.localeCompare(b.code)
  );
}
