import { z } from "zod";
import { strictObject } from "@/contracts/schemas/common";

export const problemDetailsSchema = strictObject({
  type: z.string().url(),
  title: z.string().min(1).max(200),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1).max(1000),
  code: z
    .string()
    .regex(/^[A-Z0-9_]+$/)
    .max(100),
  retryable: z.boolean(),
  fieldErrors: z
    .array(strictObject({ field: z.string().max(100), message: z.string().max(300) }))
    .max(50),
  currentRevision: z.number().int().positive().optional(),
  traceId: z.string().uuid()
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
