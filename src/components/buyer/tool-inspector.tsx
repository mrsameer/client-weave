"use client";

import { useState } from "react";

type Capability = {
  name: string;
  stateEffect: string;
  requiresHumanConfirmation: boolean;
  recentInvocations: Array<{ outcome: string; reason: string; at: string }>;
};

export function ToolInspector() {
  const [items, setItems] = useState<Capability[] | null>(null);
  const [open, setOpen] = useState(false);
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !items) {
      const response = await fetch("/api/v1/scopes/current/inspector");
      if (response.ok) setItems((await response.json()).capabilities);
    }
  }
  return (
    <section>
      <button type="button" aria-expanded={open} onClick={toggle}>
        Agent capability inspector
      </button>
      {open ? (
        <div>
          <h2>Available agent actions</h2>
          {items ? (
            <ul>
              {items.map((item) => (
                <li key={item.name}>
                  <strong>{item.name}</strong> — {item.stateEffect}; human confirmation{" "}
                  {item.requiresHumanConfirmation ? "required" : "not required"}
                  {item.recentInvocations.length ? (
                    <ul>
                      {item.recentInvocations.map((invocation, index) => (
                        <li key={`${item.name}-${invocation.at}-${index}`}>
                          {invocation.outcome}: {invocation.reason} (
                          {new Date(invocation.at).toLocaleString()})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span> — no recent invocations</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Loading capability metadata…</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
