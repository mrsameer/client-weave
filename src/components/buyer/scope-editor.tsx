"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldDefinition } from "@/modules/scope/domain/normalize-scope";
import type { ScopeValue } from "@/db/repositories/scope-repository";
import { ProvenanceBadge } from "./provenance-badge";

type EditableScope = {
  revision: number;
  goal: string;
  goalActor: string;
  goalUpdatedAt: string;
  budgetMaxMinor: number | null;
  budgetActor: string;
  budgetUpdatedAt: string;
  targetDeliveryDate: string | null;
  deliveryActor: string;
  deliveryUpdatedAt: string;
  assumptions: Array<{ value: string; actor: string; updatedAt: string }>;
  answers: Record<string, { value: ScopeValue; actor: string; updatedAt: string }>;
  fields: FieldDefinition[];
};

const labelFor = (key: string) =>
  key.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());

function fallbackField(key: string, value: ScopeValue): FieldDefinition {
  return {
    key,
    type: Array.isArray(value)
      ? "MULTI_SELECT"
      : typeof value === "boolean"
        ? "BOOLEAN"
        : typeof value === "number"
          ? "NUMBER"
          : "TEXT",
    required: false
  };
}
const csrf = () =>
  document.cookie
    .split("; ")
    .find((part) => part.startsWith("clientweave_csrf="))
    ?.split("=")[1] ?? "";

export function ScopeEditor({
  scope,
  hasQuote,
  onUpdated,
  onStatus
}: {
  scope: EditableScope;
  hasQuote: boolean;
  onUpdated(updated: EditableScope): void;
  onStatus(message: string): void;
}) {
  const [goal, setGoal] = useState(scope.goal);
  const [budget, setBudget] = useState(
    scope.budgetMaxMinor === null ? "" : String(scope.budgetMaxMinor / 100)
  );
  const [delivery, setDelivery] = useState(scope.targetDeliveryDate?.slice(0, 10) ?? "");
  const [assumptions, setAssumptions] = useState(
    scope.assumptions.map((item) => item.value).join("\n")
  );
  const [answers, setAnswers] = useState<Record<string, ScopeValue>>(
    Object.fromEntries(Object.entries(scope.answers).map(([key, answer]) => [key, answer.value]))
  );
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [remoteChange, setRemoteChange] = useState(false);
  const lastRevision = useRef(scope.revision);

  const fields = useMemo(() => {
    const configured = new Map(scope.fields.map((field) => [field.key, field]));
    for (const [key, answer] of Object.entries(scope.answers))
      if (!configured.has(key)) configured.set(key, fallbackField(key, answer.value));
    return [...configured.values()];
  }, [scope.answers, scope.fields]);

  function replaceDraft(nextScope: EditableScope) {
    setGoal(nextScope.goal);
    setBudget(nextScope.budgetMaxMinor === null ? "" : String(nextScope.budgetMaxMinor / 100));
    setDelivery(nextScope.targetDeliveryDate?.slice(0, 10) ?? "");
    setAssumptions(nextScope.assumptions.map((item) => item.value).join("\n"));
    setAnswers(
      Object.fromEntries(
        Object.entries(nextScope.answers).map(([key, answer]) => [key, answer.value])
      )
    );
    setDirty(false);
    setRemoteChange(false);
  }

  useEffect(() => {
    if (scope.revision === lastRevision.current) return;
    lastRevision.current = scope.revision;
    if (dirty) {
      const deferred = window.setTimeout(() => setRemoteChange(true), 0);
      return () => window.clearTimeout(deferred);
    }
    const deferred = window.setTimeout(() => replaceDraft(scope), 0);
    return () => window.clearTimeout(deferred);
  }, [dirty, scope]);

  function updateAnswer(key: string, value: ScopeValue) {
    setDirty(true);
    setAnswers((current) => ({ ...current, [key]: value }));
  }
  async function save() {
    setMessage("Saving changes…");
    const budgetMaxMinor = budget.trim() ? Math.round(Number(budget) * 100) : null;
    const response = await fetch("/api/v1/scopes/current", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "if-match": `"${scope.revision}"`,
        "x-csrf-token": decodeURIComponent(csrf())
      },
      body: JSON.stringify({
        goal,
        budgetMaxMinor,
        targetDeliveryDate: delivery || null,
        assumptions: assumptions
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        answers
      })
    });
    const body = await response.json();
    if (!response.ok) {
      const nextMessage =
        response.status === 412
          ? "This scope changed elsewhere. Review the latest values before saving again."
          : (body.detail ?? "Could not save changes.");
      setMessage(nextMessage);
      onStatus(nextMessage);
      return;
    }
    setDirty(false);
    onUpdated(body);
    setMessage("Saved. Any prior quote may need to be recalculated.");
    onStatus("Scope saved. Any prior quote may need to be recalculated.");
  }
  return (
    <section>
      <h2>Edit scope</h2>
      {remoteChange ? (
        <div role="alert">
          <p>
            This scope changed elsewhere while you were editing. Review the visible provenance
            before choosing which version to keep.
          </p>
          <button type="button" onClick={() => replaceDraft(scope)}>
            Use latest shared values
          </button>
        </div>
      ) : null}
      {hasQuote ? (
        <p role="status">
          Saving a pricing-related change will make the current quote stale until it is
          recalculated.
        </p>
      ) : null}
      <label htmlFor="scope-goal">Goal</label>
      <ProvenanceBadge actor={scope.goalActor} updatedAt={scope.goalUpdatedAt} />
      <textarea
        id="scope-goal"
        value={goal}
        onChange={(event) => {
          setDirty(true);
          setGoal(event.target.value);
        }}
        maxLength={1000}
      />
      <label htmlFor="scope-budget">Maximum budget (USD)</label>
      <ProvenanceBadge actor={scope.budgetActor} updatedAt={scope.budgetUpdatedAt} />
      <input
        id="scope-budget"
        inputMode="decimal"
        value={budget}
        onChange={(event) => {
          setDirty(true);
          setBudget(event.target.value);
        }}
      />
      <label htmlFor="scope-delivery">Target delivery date</label>
      <ProvenanceBadge actor={scope.deliveryActor} updatedAt={scope.deliveryUpdatedAt} />
      <input
        id="scope-delivery"
        type="date"
        value={delivery}
        onChange={(event) => {
          setDirty(true);
          setDelivery(event.target.value);
        }}
      />
      <label htmlFor="scope-assumptions">Assumptions (one per line)</label>
      <textarea
        id="scope-assumptions"
        value={assumptions}
        onChange={(event) => {
          setDirty(true);
          setAssumptions(event.target.value);
        }}
        maxLength={10000}
      />
      {scope.assumptions.length ? (
        <ul aria-label="Current assumption provenance">
          {scope.assumptions.map((assumption) => (
            <li key={assumption.value}>
              {assumption.value}{" "}
              <ProvenanceBadge actor={assumption.actor} updatedAt={assumption.updatedAt} />
            </li>
          ))}
        </ul>
      ) : null}
      <fieldset>
        <legend>Service requirements</legend>
        {fields.map((field) => {
          const answer = scope.answers[field.key];
          const value = answers[field.key];
          const id = `scope-answer-${field.key}`;
          return (
            <div key={field.key}>
              <label htmlFor={id}>
                {labelFor(field.key)}
                {field.required ? " (required)" : ""}
              </label>
              {answer ? (
                <ProvenanceBadge actor={answer.actor} updatedAt={answer.updatedAt} />
              ) : null}
              {field.type === "BOOLEAN" ? (
                <input
                  id={id}
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => updateAnswer(field.key, event.target.checked)}
                />
              ) : field.type === "SELECT" ? (
                <select
                  id={id}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => updateAnswer(field.key, event.target.value || null)}
                >
                  <option value="">Select an option</option>
                  {(field.choices ?? []).map((choice) => (
                    <option key={choice} value={choice}>
                      {choice}
                    </option>
                  ))}
                </select>
              ) : field.type === "MULTI_SELECT" ? (
                <div aria-label={labelFor(field.key)}>
                  {(field.choices ?? []).map((choice) => {
                    const selected = Array.isArray(value) && value.includes(choice);
                    return (
                      <label key={choice}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            updateAnswer(
                              field.key,
                              event.target.checked
                                ? [...(Array.isArray(value) ? value : []), choice]
                                : (Array.isArray(value) ? value : []).filter(
                                    (item) => item !== choice
                                  )
                            )
                          }
                        />
                        {choice}
                      </label>
                    );
                  })}
                </div>
              ) : field.type === "NUMBER" ? (
                <input
                  id={id}
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={typeof value === "number" ? value : ""}
                  onChange={(event) =>
                    updateAnswer(
                      field.key,
                      event.target.value === "" ? null : Number(event.target.value)
                    )
                  }
                />
              ) : (
                <textarea
                  id={id}
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => updateAnswer(field.key, event.target.value || null)}
                  maxLength={4000}
                />
              )}
            </div>
          );
        })}
      </fieldset>
      <button type="button" onClick={save}>
        Save scope changes
      </button>
      <p aria-live="polite">{message}</p>
    </section>
  );
}
