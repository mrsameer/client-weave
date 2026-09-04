export type ServiceOffering = {
  slug: string;
  name: string;
  description: string;
  active: boolean;
  basePriceMinor: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  includedItems: string[];
};
