import { z } from "zod";
import { stateEffectSchema, strictObject } from "./common";

export const capabilitySchema = strictObject({
  name: z.enum([
    "discover_services",
    "create_scope",
    "update_scope",
    "price_scope",
    "find_consultation_slots",
    "finalize_confirmed_scope"
  ]),
  stateEffect: stateEffectSchema,
  requiresHumanConfirmation: z.boolean()
});

export const capabilitiesSchema = z.array(capabilitySchema).length(6);
