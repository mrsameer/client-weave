import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_BYTES = 32;

export type ScopeCapability = { reference: string; secret: string };

export function createScopeCapability(
  reference = randomBytes(16).toString("base64url")
): ScopeCapability {
  return { reference, secret: randomBytes(TOKEN_BYTES).toString("base64url") };
}

/** Cookie-session material is generated server-side and never placed in a URL fragment. */
export function createScopeSessionSecret(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashScopeSecret(secret: string, pepper: string): string {
  return createHash("sha256").update(pepper).update("\0").update(secret).digest("hex");
}

export function verifyScopeSecret(secret: string, pepper: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashScopeSecret(secret, pepper), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function scopeCookie(value: string) {
  return {
    name: "__Host-clientweave_scope",
    value,
    httpOnly: true,
    secure: true,
    sameSite: "strict" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}

export function csrfToken(): string {
  return randomBytes(32).toString("base64url");
}
