"use client";

import type { ConfigurationConstraint } from "@/modules/catalog/domain/service-configuration";

export function ConstraintEditor({
  constraints,
  fields,
  onChange
}: {
  constraints: ConfigurationConstraint[];
  fields: string[];
  onChange(constraints: ConfigurationConstraint[]): void;
}) {
  return (
    <fieldset>
      <legend>Delivery and compatibility constraints</legend>
      <p>Constraints are validated against the configured intake fields when publishing.</p>
      <label>
        Constraint kind
        <select
          onChange={(event) => {
            const kind = event.target.value;
            if (kind === "MAX_DELIVERY_DAYS") onChange([...constraints, { kind, days: 14 }]);
            if (kind === "REQUIRES_FIELD" && fields[0])
              onChange([...constraints, { kind, field: fields[0] }]);
            if (kind === "INCOMPATIBLE_FIELDS" && fields.length > 1)
              onChange([...constraints, { kind, fields: fields.slice(0, 2) }]);
            event.currentTarget.value = "";
          }}
          defaultValue=""
        >
          <option value="">Add constraint</option>
          <option value="MAX_DELIVERY_DAYS">Maximum delivery days</option>
          <option value="REQUIRES_FIELD">Required field</option>
          <option value="INCOMPATIBLE_FIELDS">Incompatible fields</option>
        </select>
      </label>
      {constraints.map((constraint, index) => (
        <p key={index}>
          {constraint.kind === "MAX_DELIVERY_DAYS"
            ? `Maximum ${constraint.days} days`
            : constraint.kind === "REQUIRES_FIELD"
              ? `Requires ${constraint.field}`
              : `Incompatible: ${constraint.fields.join(", ")}`}{" "}
          <button
            type="button"
            onClick={() => onChange(constraints.filter((_, current) => current !== index))}
          >
            Remove
          </button>
        </p>
      ))}
    </fieldset>
  );
}
