import { z } from "zod";
import { actorSchema, minorMoney, strictObject, uuidSchema } from "./common";
import { scopeValueSchema } from "./scope";

export const issueSchema = strictObject({
  code: z.string().max(100),
  field: z.string().max(100),
  message: z.string().max(500),
  severity: z.enum(["MISSING", "CONFLICT"])
});

export const quoteLineItemSchema = strictObject({
  ruleId: z.string().min(1).max(100),
  label: z.string().max(200),
  amountMinor: z.number().int(),
  kind: z.enum(["BASE", "QUANTITY", "ADDON", "CONDITIONAL"]),
  priority: z.number().int()
});

export const quoteResultSchema = strictObject({
  status: z.enum(["INCOMPLETE", "CONFLICTED", "CURRENT", "STALE"]),
  eligible: z.boolean(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  minimumTotalMinor: minorMoney.optional(),
  maximumTotalMinor: minorMoney.optional(),
  lineItems: z.array(quoteLineItemSchema),
  assumptions: z.array(scopeValueSchema),
  issues: z.array(issueSchema),
  calculatedAt: z.string().datetime(),
  pricingRuleVersion: z.number().int().positive().optional()
});

export const scopeReviewSchema = strictObject({
  id: uuidSchema,
  ref: z.string().min(16).max(128),
  revision: z.number().int().positive(),
  serviceSlug: z.string().max(100),
  goal: scopeValueSchema,
  budgetMaxMinor: scopeValueSchema,
  targetDeliveryDate: scopeValueSchema,
  assumptions: z.array(scopeValueSchema).max(20),
  answers: z.record(z.string().max(100), scopeValueSchema),
  actor: actorSchema,
  missingFields: z.array(issueSchema),
  conflicts: z.array(issueSchema),
  quote: quoteResultSchema.nullable()
});
