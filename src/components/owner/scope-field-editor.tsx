"use client";

import type { ConfigurationField } from "@/modules/catalog/domain/service-configuration";

export function ScopeFieldEditor({
  fields,
  onChange
}: {
  fields: ConfigurationField[];
  onChange(fields: ConfigurationField[]): void;
}) {
  const update = (index: number, next: Partial<ConfigurationField>) =>
    onChange(fields.map((field, current) => (current === index ? { ...field, ...next } : field)));
  return (
    <fieldset>
      <legend>Intake fields</legend>
      {fields.map((field, index) => (
        <div key={`${field.key}-${index}`}>
          <label>
            Key
            <input
              value={field.key}
              onChange={(event) => update(index, { key: event.target.value })}
            />
          </label>
          <label>
            Type
            <select
              value={field.type}
              onChange={(event) => {
                const type = event.target.value as ConfigurationField["type"];
                update(index, {
                  type,
                  ...(type === "SELECT" ? { choices: [] } : { choices: undefined })
                });
              }}
            >
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
              <option value="BOOLEAN">Boolean</option>
              <option value="SELECT">Choice</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(event) => update(index, { required: event.target.checked })}
            />
            Required
          </label>
          {field.type === "SELECT" ? (
            <label>
              Choices (comma separated)
              <input
                value={(field.choices ?? []).join(", ")}
                onChange={(event) =>
                  update(index, {
                    choices: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean)
                  })
                }
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(fields.filter((_, current) => current !== index))}
          >
            Remove field
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...fields, { key: "requirement", type: "TEXT", required: false }])}
      >
        Add intake field
      </button>
    </fieldset>
  );
}
