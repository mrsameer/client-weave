"use client";

import type { ConfigurationRule } from "@/modules/catalog/domain/service-configuration";

export function PricingRuleEditor({
  rules,
  fields,
  onChange
}: {
  rules: ConfigurationRule[];
  fields: string[];
  onChange(rules: ConfigurationRule[]): void;
}) {
  const update = (index: number, next: Partial<ConfigurationRule>) =>
    onChange(rules.map((rule, current) => (current === index ? { ...rule, ...next } : rule)));
  return (
    <fieldset>
      <legend>Pricing rules</legend>
      {rules.map((rule, index) => (
        <div key={`${rule.id}-${index}`}>
          <label>
            Rule ID
            <input
              value={rule.id}
              onChange={(event) => update(index, { id: event.target.value })}
            />
          </label>
          <label>
            Label
            <input
              value={rule.label}
              onChange={(event) => update(index, { label: event.target.value })}
            />
          </label>
          <label>
            Priority
            <input
              type="number"
              value={rule.priority}
              onChange={(event) => update(index, { priority: Number(event.target.value) })}
            />
          </label>
          <label>
            Kind
            <select
              value={rule.kind}
              onChange={(event) =>
                update(index, { kind: event.target.value as ConfigurationRule["kind"] })
              }
            >
              <option value="BASE">Base</option>
              <option value="QUANTITY">Quantity</option>
              <option value="ADDON">Add-on</option>
              <option value="CONDITIONAL">Conditional</option>
            </select>
          </label>
          {rule.kind !== "BASE" ? (
            <label>
              Field
              <select
                value={rule.field ?? ""}
                onChange={(event) => update(index, { field: event.target.value })}
              >
                <option value="">Choose field</option>
                {fields.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Fixed minor units
            <input
              type="number"
              value={rule.amountMinor ?? ""}
              onChange={(event) =>
                update(index, {
                  amountMinor: event.target.value ? Number(event.target.value) : undefined
                })
              }
            />
          </label>
          <label>
            Percent basis points
            <input
              type="number"
              value={rule.percentBasisPoints ?? ""}
              onChange={(event) =>
                update(index, {
                  percentBasisPoints: event.target.value ? Number(event.target.value) : undefined
                })
              }
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(rules.filter((_, current) => current !== index))}
          >
            Remove rule
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rules,
            {
              id: `rule_${rules.length + 1}`,
              kind: "BASE",
              priority: rules.length,
              label: "New adjustment",
              amountMinor: 0
            }
          ])
        }
      >
        Add pricing rule
      </button>
    </fieldset>
  );
}
