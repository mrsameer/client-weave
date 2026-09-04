import { z } from "zod";

const keySchema = z.string().regex(/^[a-z][a-z0-9_]{1,99}$/);
const safeTextSchema = z
  .string()
  .max(4000)
  .refine((value) => !/[<>]|\b(?:javascript|eval|function|script)\b/i.test(value), {
    message: "Configuration text must not contain executable markup or code."
  });

export const configurationFieldSchema = z
  .object({
    key: keySchema,
    type: z.enum(["TEXT", "NUMBER", "BOOLEAN", "SELECT"]),
    required: z.boolean(),
    choices: z.array(z.string().min(1).max(160)).min(1).max(100).optional()
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.type === "SELECT" && !field.choices)
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Choice fields require choices."
      });
    if (field.type !== "SELECT" && field.choices)
      ctx.addIssue({
        code: "custom",
        path: ["choices"],
        message: "Only choice fields may have choices."
      });
  });
export type ConfigurationField = z.infer<typeof configurationFieldSchema>;

export const configurationRuleSchema = z
  .object({
    id: keySchema,
    kind: z.enum(["BASE", "QUANTITY", "ADDON", "CONDITIONAL"]),
    priority: z.number().int().min(0).max(10_000),
    label: safeTextSchema.min(1).max(160),
    field: keySchema.optional(),
    amountMinor: z.number().int().min(0).max(100_000_000).optional(),
    percentBasisPoints: z.number().int().min(-10_000).max(10_000).optional()
  })
  .strict()
  .superRefine((rule, ctx) => {
    if (rule.amountMinor === undefined && rule.percentBasisPoints === undefined)
      ctx.addIssue({ code: "custom", message: "Rule requires a fixed amount or percentage." });
    if (rule.kind === "BASE" && rule.field)
      ctx.addIssue({
        code: "custom",
        path: ["field"],
        message: "Base rules cannot reference a field."
      });
    if (rule.kind !== "BASE" && !rule.field)
      ctx.addIssue({ code: "custom", path: ["field"], message: "This rule requires a field." });
  });
export type ConfigurationRule = z.infer<typeof configurationRuleSchema>;

export const configurationConstraintSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("MAX_DELIVERY_DAYS"), days: z.number().int().min(1).max(3650) })
    .strict(),
  z.object({ kind: z.literal("REQUIRES_FIELD"), field: keySchema }).strict(),
  z
    .object({ kind: z.literal("INCOMPATIBLE_FIELDS"), fields: z.array(keySchema).min(2).max(10) })
    .strict()
]);
export type ConfigurationConstraint = z.infer<typeof configurationConstraintSchema>;
export type ServiceConfiguration = {
  name: string;
  description: string;
  basePriceMinor: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  includedItems: string[];
  fields: ConfigurationField[];
  rules: ConfigurationRule[];
  constraints?: ConfigurationConstraint[];
  activeServiceCount: number;
};

export type ConfigurationIssue = { field: string; message: string };

export function validateServiceConfiguration(
  configuration: ServiceConfiguration
): ConfigurationIssue[] {
  const issues: ConfigurationIssue[] = [];
  for (const issue of z
    .object({
      name: safeTextSchema.min(1).max(160),
      description: safeTextSchema.min(1),
      basePriceMinor: z.number().int(),
      deliveryMinDays: z.number().int(),
      deliveryMaxDays: z.number().int(),
      includedItems: z.array(safeTextSchema.min(1).max(300)),
      fields: z.array(configurationFieldSchema),
      rules: z.array(configurationRuleSchema),
      constraints: z.array(configurationConstraintSchema).optional(),
      activeServiceCount: z.number().int()
    })
    .strict()
    .safeParse(configuration).error?.issues ?? [])
    issues.push({ field: issue.path.join(".") || "configuration", message: issue.message });
  if (!configuration.name.trim() || configuration.name.length > 160)
    issues.push({ field: "name", message: "Name is required and bounded." });
  if (!configuration.description.trim() || configuration.description.length > 4000)
    issues.push({ field: "description", message: "Description is required and bounded." });
  if (!Number.isInteger(configuration.basePriceMinor) || configuration.basePriceMinor < 0)
    issues.push({ field: "basePriceMinor", message: "Base price must be a non-negative integer." });
  if (
    configuration.deliveryMinDays < 1 ||
    configuration.deliveryMaxDays < configuration.deliveryMinDays
  )
    issues.push({ field: "delivery", message: "Delivery range is invalid." });
  if (!configuration.includedItems.length)
    issues.push({ field: "includedItems", message: "At least one included item is required." });
  if (configuration.activeServiceCount > 10)
    issues.push({ field: "activeServiceCount", message: "At most ten services may be active." });
  const fields = new Set<string>();
  for (const field of configuration.fields) {
    if (!/^[a-z][a-z0-9_]{1,99}$/.test(field.key) || fields.has(field.key))
      issues.push({ field: "fields", message: "Field keys must be unique stable identifiers." });
    fields.add(field.key);
    if (field.type === "SELECT" && !field.choices?.length)
      issues.push({ field: `fields.${field.key}`, message: "Choice fields require choices." });
  }
  const priorities = new Set<number>();
  for (const rule of configuration.rules) {
    if (priorities.has(rule.priority))
      issues.push({ field: "rules", message: "Rule priorities must be unique." });
    priorities.add(rule.priority);
    if (rule.field && !fields.has(rule.field))
      issues.push({ field: `rules.${rule.id}`, message: "Rule references an unknown field." });
    if (rule.amountMinor === undefined && rule.percentBasisPoints === undefined)
      issues.push({
        field: `rules.${rule.id}`,
        message: "Rule requires a fixed amount or percentage."
      });
  }
  for (const constraint of configuration.constraints ?? []) {
    const referenced =
      constraint.kind === "INCOMPATIBLE_FIELDS"
        ? constraint.fields
        : constraint.kind === "REQUIRES_FIELD"
          ? [constraint.field]
          : [];
    if (referenced.some((field) => !fields.has(field)))
      issues.push({ field: "constraints", message: "Constraint references an unknown field." });
  }
  return issues;
}
