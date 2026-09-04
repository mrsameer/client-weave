export class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const headers = new Headers({ accept: "application/json" });
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
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
