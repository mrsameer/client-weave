import { capabilityRegistry, assertCapabilityRegistry } from "../src/webmcp/registry";
import {
  createBuyerScope,
  discoverBuyerServices,
  priceBuyerScope
} from "../src/contracts/http/buyer-client";

assertCapabilityRegistry();
if (capabilityRegistry.length !== 6) throw new Error("Expected exactly six WebMCP capabilities");
const effects = new Set(capabilityRegistry.map((capability) => capability.stateEffect));
if (
  effects.size !== 4 ||
  !["READ_ONLY", "DRAFT_MUTATION", "DERIVED_RECORD_WRITE", "CONSEQUENTIAL_WRITE"].every((effect) =>
    effects.has(effect as (typeof capabilityRegistry)[number]["stateEffect"])
  )
)
  throw new Error("The capability registry must expose the exact four-value state-effect catalog");
if (
  ![discoverBuyerServices, createBuyerScope, priceBuyerScope].every(
    (capability) => typeof capability === "function"
  )
)
  throw new Error("Buyer client must expose discovery, scope creation, and pricing capabilities");
