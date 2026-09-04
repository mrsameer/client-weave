"use client";

import { useActionState, useState } from "react";
import { publishServiceAction, type PublishServiceState } from "@/app/owner/services/actions";
import type { ServiceConfiguration } from "@/modules/catalog/domain/service-configuration";
import { ConstraintEditor } from "./constraint-editor";
import { PricingRuleEditor } from "./pricing-rule-editor";
import { ScopeFieldEditor } from "./scope-field-editor";

const initialState: PublishServiceState = {};
const template: ServiceConfiguration = {
  name: "New service",
  description: "Describe the buyer outcome in plain language.",
  basePriceMinor: 10000,
  deliveryMinDays: 3,
  deliveryMaxDays: 10,
  includedItems: ["Discovery"],
  fields: [],
  rules: [],
  constraints: [],
  activeServiceCount: 1
};

export function ServiceEditor({
  serviceId,
  slug = "new-service",
  initialConfiguration = template
}: {
  serviceId?: string;
  slug?: string;
  initialConfiguration?: ServiceConfiguration;
}) {
  const [state, action, pending] = useActionState(publishServiceAction, initialState);
  const [configuration, setConfiguration] = useState(initialConfiguration);
  const fieldKeys = configuration.fields.map((field) => field.key);
  return (
    <form action={action}>
      {serviceId ? <input type="hidden" name="serviceId" value={serviceId} /> : null}
      <label htmlFor="service-slug">URL slug</label>
      <input id="service-slug" name="slug" defaultValue={slug} required pattern="[a-z0-9-]+" />
      <input type="hidden" name="configuration" value={JSON.stringify(configuration)} />
      <label htmlFor="service-name">Service name</label>
      <input
        id="service-name"
        value={configuration.name}
        onChange={(event) => setConfiguration({ ...configuration, name: event.target.value })}
      />
      <label htmlFor="service-description">Description</label>
      <textarea
        id="service-description"
        value={configuration.description}
        onChange={(event) =>
          setConfiguration({ ...configuration, description: event.target.value })
        }
      />
      <label htmlFor="service-base-price">Base price (minor units)</label>
      <input
        id="service-base-price"
        type="number"
        value={configuration.basePriceMinor}
        onChange={(event) =>
          setConfiguration({ ...configuration, basePriceMinor: Number(event.target.value) })
        }
      />
      <ScopeFieldEditor
        fields={configuration.fields}
        onChange={(fields) => setConfiguration({ ...configuration, fields })}
      />
      <PricingRuleEditor
        rules={configuration.rules}
        fields={fieldKeys}
        onChange={(rules) => setConfiguration({ ...configuration, rules })}
      />
      <ConstraintEditor
        constraints={configuration.constraints ?? []}
        fields={fieldKeys}
        onChange={(constraints) => setConfiguration({ ...configuration, constraints })}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Publishing…" : "Publish version"}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.version ? <p role="status">Published version {state.version}.</p> : null}
    </form>
  );
}
