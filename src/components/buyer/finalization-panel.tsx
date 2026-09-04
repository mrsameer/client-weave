"use client";

import { useState } from "react";
import { FinalSummary, type FinalSummaryModel } from "./final-summary";

const csrf = () =>
  document.cookie
    .split("; ")
    .find((part) => part.startsWith("clientweave_csrf="))
    ?.split("=")[1] ?? "";
export function FinalizationPanel({ slotId }: { slotId: string | null }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState<FinalSummaryModel | null>(null);
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  async function review() {
    setMessage("Preparing final review…");
    const action = slotId ? "SUBMIT_LEAD_AND_BOOK" : "SUBMIT_LEAD";
    const response = await fetch("/api/v1/scopes/current/final-summary", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": decodeURIComponent(csrf())
      },
      body: JSON.stringify({
        contact: { ...(name ? { name } : {}), ...(email ? { email } : {}) },
        action,
        ...(slotId ? { slotId } : {})
      })
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.detail ?? "Could not prepare final review.");
    setSummary(body.summary);
    setIdempotencyKey(null);
    setMessage("Review the summary, then confirm the exact action.");
  }
  async function confirm() {
    if (!summary) return;
    setMessage("Recording your confirmation…");
    const response = await fetch("/api/v1/scopes/current/human-confirmations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrf()) },
      body: JSON.stringify({
        summaryHash: summary.hash,
        nonce: summary.nonce,
        scopeRevision: summary.scopeRevision,
        expiresAt: summary.expiresAt,
        contact: summary.contact,
        action: summary.action,
        ...(summary.slotId ? { slotId: summary.slotId } : {})
      })
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.detail ?? "Confirmation could not be recorded.");
    setIdempotencyKey(crypto.randomUUID());
    setMessage("Confirmed by you. Submit the confirmed action to complete it.");
  }
  async function finalize() {
    if (!summary || !idempotencyKey) return;
    setMessage("Completing your request…");
    const response = await fetch("/api/v1/scopes/current/finalizations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": decodeURIComponent(csrf()),
        "idempotency-key": idempotencyKey
      },
      body: JSON.stringify({
        summaryHash: summary.hash,
        nonce: summary.nonce,
        contact: summary.contact,
        action: summary.action,
        ...(summary.slotId ? { slotId: summary.slotId } : {})
      })
    });
    const body = await response.json();
    if (!response.ok)
      return setMessage(body.detail ?? "The request could not be completed. You can retry safely.");
    setMessage(
      body.bookingId ? "Your consultation has been booked." : "Your lead has been submitted."
    );
  }
  return (
    <section>
      <h2>Book or submit your lead</h2>
      <label htmlFor="contact-email">Email</label>
      <input
        id="contact-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <label htmlFor="contact-name">Name (optional)</label>
      <input id="contact-name" value={name} onChange={(event) => setName(event.target.value)} />
      <button type="button" onClick={review}>
        Review final action
      </button>
      {summary ? (
        <>
          <FinalSummary summary={summary} />
          <button type="button" onClick={confirm}>
            I confirm this exact action
          </button>
          {idempotencyKey ? (
            <button type="button" onClick={finalize}>
              Submit confirmed action
            </button>
          ) : null}
        </>
      ) : null}
      <p aria-live="polite">{message}</p>
    </section>
  );
}
