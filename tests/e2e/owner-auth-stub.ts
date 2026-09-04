import { createServer, type IncomingMessage, type Server } from "node:http";

let server: Server | undefined;
const testUserPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const tokenPrefix = "owner-test-access-token-";

export function ownerEmailFor(userId: string) {
  return `${userId}@owner.test`;
}

function ownerFromEmail(email: string) {
  const id = email.split("@", 1)[0] ?? "";
  return testUserPattern.test(id) ? { id, email } : null;
}

function ownerFromAuthorization(header: string | undefined) {
  const token = header?.replace(/^Bearer\s+/i, "") ?? "";
  const id = token.startsWith(tokenPrefix) ? token.slice(tokenPrefix.length) : "";
  return testUserPattern.test(id) ? { id, email: ownerEmailFor(id) } : null;
}

function readBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => (body += chunk));
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

/** A minimal local Auth endpoint used only by database-backed owner browser tests. */
export async function ensureOwnerAuthStub() {
  if (server?.listening) return;
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1:54321");
    const send = (status: number, body: object) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      const payload = JSON.parse(await readBody(request)) as { email?: string };
      const user = ownerFromEmail(payload.email ?? "");
      if (!user) return send(400, { error: "invalid test user" });
      return send(200, {
        access_token: `${tokenPrefix}${user.id}`,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: `owner-test-refresh-token-${user.id}`,
        user: { ...user, aud: "authenticated", role: "authenticated" }
      });
    }
    if (url.pathname === "/auth/v1/user" && request.method === "GET") {
      const user = ownerFromAuthorization(request.headers.authorization);
      return user
        ? send(200, { ...user, aud: "authenticated", role: "authenticated" })
        : send(401, { error: "unauthorized" });
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve, reject) => {
    server!.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        server = undefined;
        resolve();
        return;
      }
      reject(error);
    });
    server!.listen(54321, "127.0.0.1", () => {
      server!.removeAllListeners("error");
      resolve();
    });
  });
}
