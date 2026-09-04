/** Generated from the authoritative Zod schemas. Do not edit manually. */
import type { z } from "zod";
import { capabilitySchema, capabilitiesSchema } from "../schemas/capabilities";
import { discoverServicesQuerySchema, serviceMatchSchema } from "../schemas/catalog";
import {
  createScopeRequestSchema,
  finalizationRequestSchema,
  priceScopeRequestSchema,
  updateScopeRequestSchema
} from "../schemas/scope";
import { quoteResultSchema, scopeReviewSchema } from "../schemas/review";

export type Capability = z.infer<typeof capabilitySchema>;
export type Capabilities = z.infer<typeof capabilitiesSchema>;
export type DiscoverServicesQuery = z.infer<typeof discoverServicesQuerySchema>;
export type ServiceMatch = z.infer<typeof serviceMatchSchema>;
export type CreateScopeRequest = z.infer<typeof createScopeRequestSchema>;
export type UpdateScopeRequest = z.infer<typeof updateScopeRequestSchema>;
export type PriceScopeRequest = z.infer<typeof priceScopeRequestSchema>;
export type FinalizationRequest = z.infer<typeof finalizationRequestSchema>;
export type QuoteResult = z.infer<typeof quoteResultSchema>;
export type ScopeReview = z.infer<typeof scopeReviewSchema>;

export { capabilitySchema, capabilitiesSchema } from "../schemas/capabilities";
export { discoverServicesQuerySchema, serviceMatchSchema } from "../schemas/catalog";
export {
  createScopeRequestSchema,
  finalizationRequestSchema,
  priceScopeRequestSchema,
  updateScopeRequestSchema
} from "../schemas/scope";
export { quoteResultSchema, scopeReviewSchema } from "../schemas/review";
