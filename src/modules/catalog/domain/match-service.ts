import type { ServiceOffering } from "./service";

export type MatchRequest = {
  need: string;
  budgetMaxMinor?: number;
  desiredDeliveryDate?: string;
  today?: Date;
};
export type ServiceMatch = ServiceOffering & {
  eligible: boolean;
  overlap: number;
  fitReasons: string[];
  conflicts: string[];
};

const tokenize = (value: string) =>
  new Set(
    value
      .normalize("NFKC")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );

export function matchServices(services: ServiceOffering[], request: MatchRequest): ServiceMatch[] {
  const needTokens = tokenize(request.need);
  const requestedDate = request.desiredDeliveryDate
    ? new Date(`${request.desiredDeliveryDate}T00:00:00Z`)
    : undefined;
  const today = request.today ?? new Date();
  return services
    .filter((service) => service.active)
    .map((service) => {
      const tokens = tokenize(
        [service.name, service.description, ...service.includedItems].join(" ")
      );
      const overlap = [...needTokens].filter((token) => tokens.has(token)).length;
      const fitReasons: string[] = [];
      const conflicts: string[] = [];
      if (request.budgetMaxMinor !== undefined) {
        if (request.budgetMaxMinor >= service.basePriceMinor)
          fitReasons.push("Base price fits the stated budget.");
        else conflicts.push("Base price exceeds the stated budget.");
      }
      if (requestedDate) {
        const earliest = new Date(today);
        earliest.setUTCDate(earliest.getUTCDate() + service.deliveryMinDays);
        if (requestedDate >= earliest) fitReasons.push("Requested delivery timing is feasible.");
        else conflicts.push("Requested delivery date is earlier than this service can support.");
      }
      return { ...service, eligible: conflicts.length === 0, overlap, fitReasons, conflicts };
    })
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) ||
        b.overlap - a.overlap ||
        a.slug.localeCompare(b.slug)
    );
}
