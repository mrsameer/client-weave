"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createBuyerScope } from "@/contracts/http/buyer-client";

type Detail = {
  slug: string;
  name: string;
  description: string;
  basePriceMinor: number;
  currency: string;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  includedItems: string[];
};

export function ServiceDetail() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [service, setService] = useState<Detail | null>(null);
  const [goal, setGoal] = useState("");
  const [message, setMessage] = useState("Loading service…");
  useEffect(() => {
    fetch(`/api/v1/services/${encodeURIComponent(params.slug)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) return setMessage(body.detail ?? "Service is unavailable.");
        setService(body);
        setMessage("");
      })
      .catch(() => setMessage("Service is unavailable."));
  }, [params.slug]);
  async function startDraft() {
    if (!goal.trim() || !service) return setMessage("Describe your goal before starting a draft.");
    setMessage("Creating your draft…");
    try {
      const body = await createBuyerScope({ serviceSlug: service.slug, goal });
      router.push(body.continuationUrl);
    } catch {
      setMessage("Could not create a draft.");
    }
  }
  if (!service)
    return (
      <main>
        <Link href="/">← Services</Link>
        <p role="status">{message}</p>
      </main>
    );
  return (
    <main>
      <Link href="/">← Services</Link>
      <p className="eyebrow">Service detail</p>
      <h1>{service.name}</h1>
      <p>{service.description}</p>
      <p>
        <strong>
          {new Intl.NumberFormat("en-US", { style: "currency", currency: service.currency }).format(
            service.basePriceMinor / 100
          )}
        </strong>{" "}
        · {service.deliveryMinDays}–{service.deliveryMaxDays} days
      </p>
      <h2>Included</h2>
      <ul>
        {service.includedItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <label htmlFor="goal">What should this service achieve?</label>
      <textarea
        id="goal"
        value={goal}
        onChange={(event) => setGoal(event.target.value)}
        maxLength={1000}
      />
      <br />
      <button type="button" onClick={startDraft}>
        Start a draft scope
      </button>
      <p aria-live="polite">{message}</p>
    </main>
  );
}
