import { z } from "zod";
import {
  actorSchema,
  boundedText,
  dateSchema,
  minorMoney,
  strictObject,
  uuidSchema
} from "./common";

export const scopeValueSchema = strictObject({
  value: z.union([
    z.string().max(4000),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().max(200)).max(20),
    z.null()
  ]),
  actor: actorSchema,
  updatedAt: z.string().datetime()
});

export const createScopeRequestSchema = strictObject({
  serviceSlug: z.string().regex(/^[a-z0-9-]{3,100}$/),
  goal: boundedText(1000),
  budgetMaxMinor: minorMoney.optional(),
  targetDeliveryDate: dateSchema.optional(),
  assumptions: z.array(boundedText(500)).max(20).default([]),
  answers: z.record(z.string().max(100), scopeValueSchema.shape.value).default({})
});

export const updateScopeRequestSchema = strictObject({
  goal: boundedText(1000).optional(),
  budgetMaxMinor: minorMoney.nullable().optional(),
  targetDeliveryDate: dateSchema.nullable().optional(),
  assumptions: z.array(boundedText(500)).max(20).optional(),
  answers: z.record(z.string().max(100), scopeValueSchema.shape.value).optional()
}).refine((value) => Object.keys(value).length > 0, "At least one mutable value is required");

export const priceScopeRequestSchema = strictObject({
  expectedRevision: z.number().int().positive()
});
export const finalizationRequestSchema = strictObject({
  confirmationId: uuidSchema,
  action: z.enum(["SUBMIT_LEAD", "SUBMIT_LEAD_AND_BOOK"])
});
