"use client";

import { useCallback, useEffect, useState } from "react";
import { QuotePanel, type QuotePanelModel } from "./quote-panel";
import { AvailabilityPicker } from "./availability-picker";
import { ToolInspector } from "./tool-inspector";
import { ScopeEditor } from "./scope-editor";
import { ProvenanceBadge } from "./provenance-badge";
import { FinalizationPanel } from "./finalization-panel";
import { ScopeLiveStatus } from "./scope-live-status";
import { useLiveScope } from "./use-live-scope";
import { priceBuyerScope } from "@/contracts/http/buyer-client";
import type { FieldDefinition } from "@/modules/scope/domain/normalize-scope";
import type { ScopeValue } from "@/db/repositories/scope-repository";

type Scope = {
  ref: string;
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

export function ScopeCanvas({
  scopeRefPromise
}: {
  scopeRefPromise: Promise<{ scopeRef: string }>;
}) {
  const [scope, setScope] = useState<Scope | null>(null);
  const [quote, setQuote] = useState<QuotePanelModel | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState("Opening shared scope…");
  const applyRemoteScope = useCallback((updated: Scope) => {
    setScope(updated);
    setQuote(null);
  }, []);
  const announceRemote = useCallback((nextMessage: string) => setMessage(nextMessage), []);
  useLiveScope(scope, applyRemoteScope, announceRemote);
  useEffect(() => {
    let live = true;
    (async () => {
      const { scopeRef } = await scopeRefPromise;
      const secret = window.location.hash.slice(1);
      if (secret) {
        const exchange = await fetch("/api/v1/scopes/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scopeRef, secret })
        });
        if (!exchange.ok) {
          const body = await exchange.json();
          return live && setMessage(body.detail ?? "Scope unavailable.");
        }
        window.history.replaceState({}, "", `/s/${scopeRef}`);
      }
      const response = await fetch("/api/v1/scopes/current");
      const body = await response.json();
      if (!response.ok) return live && setMessage(body.detail ?? "Scope unavailable.");
      if (live) {
        setScope(body);
        setMessage("");
      }
    })().catch(() => live && setMessage("Scope unavailable."));
    return () => {
      live = false;
    };
  }, [scopeRefPromise]);
  async function requestQuote() {
    if (!scope) return;
    setMessage("Calculating quote…");
    try {
      setQuote(await priceBuyerScope(scope.revision));
      setMessage("Quote updated.");
    } catch {
      setMessage("Quote unavailable.");
    }
  }
  if (!scope)
    return (
      <main>
        <p role="status">{message}</p>
      </main>
    );
  return (
    <main>
      <p className="eyebrow">Shared scope</p>
      <h1>{scope.goal}</h1>
      <ProvenanceBadge actor={scope.goalActor} updatedAt={scope.goalUpdatedAt} />
      <ScopeEditor
        scope={scope}
        hasQuote={quote !== null}
        onUpdated={(updated) => {
          setScope((current) => (current ? { ...current, ...updated } : current));
          setQuote(null);
        }}
        onStatus={setMessage}
      />
      <section>
        <h2>Requirements</h2>
        <dl>
          <dt>Budget</dt>
          <dd>
            {scope.budgetMaxMinor === null
              ? "Not set"
              : `$${(scope.budgetMaxMinor / 100).toFixed(2)}`}
            <br />
            <ProvenanceBadge actor={scope.budgetActor} updatedAt={scope.budgetUpdatedAt} />
          </dd>
          <dt>Target delivery</dt>
          <dd>
            {scope.targetDeliveryDate
              ? new Date(scope.targetDeliveryDate).toLocaleDateString()
              : "Not set"}
            <br />
            <ProvenanceBadge actor={scope.deliveryActor} updatedAt={scope.deliveryUpdatedAt} />
          </dd>
          {Object.entries(scope.answers).map(([key, answer]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {String(answer.value)}{" "}
                <ProvenanceBadge actor={answer.actor} updatedAt={answer.updatedAt} />
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2>Assumptions</h2>
        <ul>
          {scope.assumptions.map((item) => (
            <li key={item.value}>
              {item.value} <ProvenanceBadge actor={item.actor} updatedAt={item.updatedAt} />
            </li>
          ))}
        </ul>
      </section>
      <button type="button" onClick={requestQuote}>
        Calculate quote
      </button>
      <ScopeLiveStatus
        message={message}
        urgent={message.includes("updated elsewhere") || message.includes("scope changed")}
      />
      <QuotePanel quote={quote} />
      {quote ? (
        <>
          <AvailabilityPicker
            onSelect={(slotId) => {
              setSelectedSlot(slotId);
              setMessage("Consultation selected. Review it before confirmation.");
            }}
          />
          {selectedSlot ? <p>Selected consultation: {selectedSlot}</p> : null}
        </>
      ) : null}
      <ToolInspector />
      {quote ? <FinalizationPanel slotId={selectedSlot} /> : null}
    </main>
  );
}
