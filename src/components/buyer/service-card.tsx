import Link from "next/link";

export type ServiceCardModel = {
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

export function ServiceCard({ service }: { service: ServiceCardModel }) {
  return (
    <article className="service-card">
      <h2>{service.name}</h2>
      <p>{service.description}</p>
      <p>
        <strong>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: service.currency }).format(
            service.basePriceMinor / 100
          )}
        </strong>{" "}
        · {service.deliveryMinDays}–{service.deliveryMaxDays} days
      </p>
      <ul>
        {service.includedItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {service.fitReasons.map((reason) => (
        <p className="status-good" key={reason}>
          {reason}
        </p>
      ))}
      {service.conflicts.map((conflict) => (
        <p className="status-warning" key={conflict}>
          {conflict}
        </p>
      ))}
      <Link href={`/services/${service.slug}`}>View service</Link>
    </article>
  );
}
