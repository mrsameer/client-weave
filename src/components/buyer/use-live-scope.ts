"use client";

import { useEffect, useRef } from "react";

type LiveScope = { revision: number };

/** Polling fallback for private realtime invalidations; responses stay capability-cookie scoped. */
export function useLiveScope<T extends LiveScope>(
  scope: T | null,
  onRemoteUpdate: (scope: T) => void,
  onError: (message: string) => void
) {
  const knownRevision = useRef<number | null>(scope?.revision ?? null);
  useEffect(() => {
    knownRevision.current = scope?.revision ?? null;
  }, [scope?.revision]);
  useEffect(() => {
    if (!scope) return;
    let cancelled = false;
    const refresh = async () => {
      const response = await fetch("/api/v1/scopes/current", { cache: "no-store" });
      if (!response.ok) return;
      const latest = (await response.json()) as T;
      if (!cancelled && knownRevision.current !== null && latest.revision > knownRevision.current) {
        knownRevision.current = latest.revision;
        onRemoteUpdate(latest);
        onError("This shared scope was updated elsewhere. The latest values are now shown.");
      }
    };
    // Keep the polling fallback comfortably inside the two-second convergence target;
    // EventSource normally delivers invalidations first.
    const interval = window.setInterval(() => void refresh(), 500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [scope, onError, onRemoteUpdate]);
  useEffect(() => {
    if (!scope || typeof EventSource === "undefined") return;
    const events = new EventSource("/api/v1/scopes/current/events");
    const onInvalidation = async (event: MessageEvent<string>) => {
      const invalidation = JSON.parse(event.data) as { revision?: number };
      if (
        invalidation.revision === undefined ||
        invalidation.revision <= (knownRevision.current ?? 0)
      )
        return;
      const response = await fetch("/api/v1/scopes/current", { cache: "no-store" });
      if (!response.ok) return;
      const latest = (await response.json()) as T;
      if (latest.revision > (knownRevision.current ?? 0)) {
        knownRevision.current = latest.revision;
        onRemoteUpdate(latest);
        onError("This shared scope was updated elsewhere. The latest values are now shown.");
      }
    };
    events.addEventListener("scope-invalidation", onInvalidation);
    return () => {
      events.removeEventListener("scope-invalidation", onInvalidation);
      events.close();
    };
  }, [scope, onError, onRemoteUpdate]);
}
