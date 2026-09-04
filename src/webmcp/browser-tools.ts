import { createScope } from "./adapters/create-scope";
import { discoverServices } from "./adapters/discover-services";
import { finalizeConfirmedScope } from "./adapters/finalize-confirmed-scope";
import { findConsultationSlots } from "./adapters/find-consultation-slots";
import { priceScope } from "./adapters/price-scope";
import { updateScope } from "./adapters/update-scope";

export type BrowserWebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Browser-native WebMCP tools. Each delegates to the same capability-tagged
 * adapter used by automated agents, preserving server-side authorization,
 * attribution, and the direct-human-confirmation boundary.
 */
export const browserWebMcpTools: readonly BrowserWebMcpTool[] = [
  {
    name: "discover_services",
    description: "Find seller-published services that fit a buyer goal, budget, and delivery date.",
    inputSchema: {
      type: "object",
      properties: {
        need: { type: "string", description: "The buyer's goal." },
        budgetMaxMinor: { type: "integer", minimum: 0 },
        desiredDeliveryDate: { type: "string", format: "date-time" }
      },
      required: ["need"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: (input) => discoverServices(input as Parameters<typeof discoverServices>[0])
  },
  {
    name: "create_scope",
    description: "Create a private draft scope for a selected seller service.",
    inputSchema: {
      type: "object",
      properties: {
        serviceSlug: { type: "string" },
        goal: { type: "string" },
        budgetMaxMinor: { type: "integer", minimum: 0 },
        targetDeliveryDate: { type: "string", format: "date-time" },
        assumptions: { type: "array", items: { type: "string" } },
        answers: { type: "object" }
      },
      required: ["serviceSlug", "goal"],
      additionalProperties: false
    },
    execute: (input) => createScope(input as Parameters<typeof createScope>[0])
  },
  {
    name: "update_scope",
    description: "Propose attributed changes to the current shared scope at its expected revision.",
    inputSchema: {
      type: "object",
      properties: {
        expectedRevision: { type: "integer", minimum: 1 },
        goal: { type: "string" },
        budgetMaxMinor: { type: ["integer", "null"], minimum: 0 },
        targetDeliveryDate: { type: ["string", "null"], format: "date-time" },
        assumptions: { type: "array", items: { type: "string" } },
        answers: { type: "object" }
      },
      required: ["expectedRevision"],
      additionalProperties: false
    },
    execute: (input) => updateScope(input as Parameters<typeof updateScope>[0])
  },
  {
    name: "price_scope",
    description: "Calculate deterministic seller-governed pricing for the current scope revision.",
    inputSchema: {
      type: "object",
      properties: { expectedRevision: { type: "integer", minimum: 1 } },
      required: ["expectedRevision"],
      additionalProperties: false
    },
    execute: (input) => priceScope(input.expectedRevision as number)
  },
  {
    name: "find_consultation_slots",
    description: "List available consultation slots without reserving or changing availability.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 100 } },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true },
    execute: (input) => findConsultationSlots((input.limit as number | undefined) ?? 10)
  },
  {
    name: "finalize_confirmed_scope",
    description:
      "Submit a lead or booking only after the buyer has directly confirmed the exact current summary.",
    inputSchema: {
      type: "object",
      properties: {
        summaryHash: { type: "string", minLength: 64, maxLength: 64 },
        nonce: { type: "string" },
        contact: {
          type: "object",
          properties: { name: { type: "string" }, email: { type: "string", format: "email" } },
          required: ["email"],
          additionalProperties: false
        },
        action: { type: "string", enum: ["SUBMIT_LEAD", "SUBMIT_LEAD_AND_BOOK"] },
        slotId: { type: "string" },
        idempotencyKey: { type: "string" }
      },
      required: ["summaryHash", "nonce", "contact", "action", "idempotencyKey"],
      additionalProperties: false
    },
    execute: (input) =>
      finalizeConfirmedScope(input as Parameters<typeof finalizeConfirmedScope>[0])
  }
];
