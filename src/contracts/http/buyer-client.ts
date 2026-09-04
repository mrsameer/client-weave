import { requestJson } from "./client";

export type BuyerServiceMatch = {
  slug: string;
  name: string;
  description: string;
  basePriceMinor: number;
  currency: string;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  includedItems: string[];
  fitReasons: string[];
  conflicts: string[];
};

export type CreateBuyerScopeInput = {
  serviceSlug: string;
  goal: string;
  budgetMaxMinor?: number;
  targetDeliveryDate?: string;
  assumptions?: string[];
  answers?: Record<string, string | number | boolean | string[] | null>;
};

export type CreatedBuyerScope = { ref: string; continuationUrl: string };
export type BuyerQuote = {
  status: "INCOMPLETE" | "CONFLICTED" | "CURRENT" | "STALE";
  eligible: boolean;
  currency?: string;
  minimumTotalMinor?: number;
  maximumTotalMinor?: number;
  lineItems: Array<{ label: string; amountMinor: number }>;
  issues: Array<{ field: string; message: string; severity: "MISSING" | "CONFLICT" }>;
};

export function discoverBuyerServices(input: {
  need: string;
  budgetMaxMinor?: number;
  desiredDeliveryDate?: string;
}) {
  const query = new URLSearchParams({
    need: input.need,
    ...(input.budgetMaxMinor === undefined ? {} : { budgetMaxMinor: String(input.budgetMaxMinor) }),
    ...(input.desiredDeliveryDate === undefined
      ? {}
      : { desiredDeliveryDate: input.desiredDeliveryDate })
  });
  return requestJson<{ services: BuyerServiceMatch[] }>(`/api/v1/services?${query}`);
}

export function createBuyerScope(input: CreateBuyerScopeInput) {
  return requestJson<CreatedBuyerScope>("/api/v1/scopes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assumptions: [], answers: {}, ...input })
  });
}

export function priceBuyerScope(expectedRevision: number) {
  return requestJson<BuyerQuote>("/api/v1/scopes/current/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision })
  });
}
