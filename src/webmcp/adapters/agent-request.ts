import { requestJson } from "@/contracts/http/client";
import type { CapabilityDefinition } from "@/webmcp/registry";

function csrfToken() {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((part) => part.startsWith("clientweave_csrf="))
      ?.split("=")[1] ?? ""
  );
}

/**
 * The adapter names the contracted capability; route handlers use that exact
 * capability to attribute a permitted mutation. It deliberately never sends
 * a raw tool payload to the audit trail.
 */
export function requestAgentJson<T>(
  capability: CapabilityDefinition["name"],
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);
  headers.set("x-clientweave-capability", capability);
  if (!headers.has("x-csrf-token") && init.method && init.method !== "GET")
    headers.set("x-csrf-token", decodeURIComponent(csrfToken()));
  return requestJson<T>(input, { ...init, headers });
}
