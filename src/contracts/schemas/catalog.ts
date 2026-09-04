import { z } from "zod";
import { boundedText, dateSchema, minorMoney, strictObject } from "./common";

export const intakeFieldSchema = strictObject({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,99}$/),
  label: boundedText(160),
  type: z.enum(["TEXT", "NUMBER", "BOOLEAN", "SELECT", "MULTI_SELECT"]),
  required: z.boolean(),
  choices: z.array(boundedText(100)).max(50).default([]),
  min: z.number().finite().optional(),
  max: z.number().finite().optional()
});

export const serviceMatchSchema = strictObject({
  slug: z.string().regex(/^[a-z0-9-]{3,100}$/),
  name: boundedText(160),
  description: boundedText(4000),
  basePriceMinor: minorMoney,
  currency: z.string().regex(/^[A-Z]{3}$/),
  deliveryMinDays: z.number().int().positive(),
  deliveryMaxDays: z.number().int().positive(),
  includedItems: z.array(boundedText(300)).max(50),
  addons: z.array(boundedText(200)).max(50),
  intakeFields: z.array(intakeFieldSchema).max(50),
  constraints: z.array(boundedText(500)).max(30),
  eligible: z.boolean(),
  fitReasons: z.array(boundedText(300)).max(20),
  conflicts: z.array(boundedText(300)).max(20)
});

export const discoverServicesQuerySchema = strictObject({
  need: boundedText(1000),
  budgetMaxMinor: minorMoney.optional(),
  desiredDeliveryDate: dateSchema.optional(),
  limit: z.number().int().min(1).max(10).default(5)
});
