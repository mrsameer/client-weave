import { z } from "zod";

export const actorSchema = z.enum(["HUMAN", "AGENT", "IMPORTED", "SYSTEM"]);
export const stateEffectSchema = z.enum([
  "READ_ONLY",
  "DRAFT_MUTATION",
  "DERIVED_RECORD_WRITE",
  "CONSEQUENTIAL_WRITE"
]);
/** Bound raw input before normalization so whitespace padding cannot bypass limits. */
export const boundedText = (maximum: number) => z.string().max(maximum).trim().min(1);
export const minorMoney = z.number().int().min(0).max(100_000_000_000);
export const dateSchema = z.string().date();
export const uuidSchema = z.string().uuid();
export const strictObject = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();
