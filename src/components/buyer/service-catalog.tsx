"use client";

import { useState } from "react";
import { discoverBuyerServices } from "@/contracts/http/buyer-client";
import { ServiceCard, type ServiceCardModel } from "./service-card";

export function ServiceCatalog() {
  const [need, setNeed] = useState("");
  const [services, setServices] = useState<ServiceCardModel[]>([]);
  const [message, setMessage] = useState("Describe what you need to compare active services.");
  async function search() {
    if (!need.trim()) return setMessage("Enter a goal to search.");
    setMessage("Searching services…");
    try {
      const body = await discoverBuyerServices({ need });
      setServices(body.services);
      setMessage(
        body.services.length
          ? `${body.services.length} service${body.services.length === 1 ? "" : "s"} found.`
          : "No active services match that need."
      );
    } catch {
      setMessage("Could not load services.");
    }
  }
  return (
    <main>
      <p className="eyebrow">ClientWeave</p>
      <h1>Find the right service</h1>
      <p>Turn a goal into an attributable, seller-priced scope—no agent required.</p>
      <label htmlFor="need">What are you trying to achieve?</label>
      <div className="search-row">
        <input
          id="need"
          value={need}
          onChange={(event) => setNeed(event.target.value)}
          placeholder="Launch a marketing website"
          maxLength={1000}
        />
        <button type="button" onClick={search}>
          Find services
        </button>
      </div>
      <p aria-live="polite">{message}</p>
      <section className="service-grid" aria-label="Matching services">
        {services.map((service) => (
          <ServiceCard key={service.slug} service={service} />
        ))}
      </section>
    </main>
  );
}
