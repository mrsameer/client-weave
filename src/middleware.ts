import { NextResponse, type NextRequest } from "next/server";

const mutatingMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const csrfCookieName = "clientweave_csrf";

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

function publicOrigin(request: NextRequest) {
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ?? request.headers.get("host");
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ??
    request.nextUrl.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : request.nextUrl.origin;
}

export function middleware(request: NextRequest) {
  if (
    mutatingMethods.has(request.method) &&
    request.nextUrl.pathname.startsWith("/api/") &&
    !request.nextUrl.pathname.includes("/exchange")
  ) {
    const origin = request.headers.get("origin");
    const csrfCookie = request.cookies.get(csrfCookieName)?.value;
    const csrfHeader = request.headers.get("x-csrf-token");
    if (
      !origin ||
      origin !== publicOrigin(request) ||
      !csrfCookie ||
      !csrfHeader ||
      csrfCookie !== csrfHeader
    )
      return new NextResponse(null, { status: 403 });
  }
  // Next reads this request header while rendering and applies the nonce to its
  // bootstrap scripts. Keeping the same policy on the response lets the page
  // hydrate without opening `script-src` to every inline script.
  const nonce = crypto.randomUUID();
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    process.env.NODE_ENV === "development"
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'"
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!request.cookies.has(csrfCookieName)) {
    response.cookies.set(csrfCookieName, crypto.randomUUID(), {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });
  }
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Cache-Control",
    request.nextUrl.pathname.startsWith("/s/") || request.nextUrl.pathname.startsWith("/owner/")
      ? "private, no-store"
      : "no-store"
  );
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
