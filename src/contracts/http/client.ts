export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function browserCsrfToken() {
  if (typeof document === "undefined") return null;
  const encoded = document.cookie
    .split("; ")
    .find((part) => part.startsWith("clientweave_csrf="))
    ?.split("=")[1];
  return encoded ? decodeURIComponent(encoded) : null;
}

export async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const method = init.method?.toUpperCase();
  if (method && method !== "GET" && method !== "HEAD" && !headers.has("x-csrf-token")) {
    const token = browserCsrfToken();
    if (token) headers.set("x-csrf-token", token);
  }
  const response = await fetch(input, {
    ...init,
    headers
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ code: "REQUEST_FAILED", detail: "Request failed" }));
    throw new HttpProblem(
      response.status,
      body.code ?? "REQUEST_FAILED",
      body.detail ?? "Request failed"
    );
  }
  return response.json() as Promise<T>;
}
