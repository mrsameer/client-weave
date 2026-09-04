import { NextRequest } from "next/server";
import { createRuntimeDatabase } from "@/db/client";
import { ScopeRepository } from "@/db/repositories/scope-repository";
import { scopeBroadcast, type ScopeInvalidation } from "@/server/realtime/scope-broadcast";
import { problemResponse } from "@/contracts/problems/to-problem-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const event = (invalidation: ScopeInvalidation) =>
  encoder.encode(`event: scope-invalidation\ndata: ${JSON.stringify(invalidation)}\n\n`);

export async function GET(request: NextRequest) {
  const tokenHash = request.cookies.get("__Host-clientweave_scope")?.value;
  if (!tokenHash)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );
  const access = await new ScopeRepository(createRuntimeDatabase()).findCapabilityAccessByHash(
    tokenHash
  );
  if (!access || access.expiresAt <= new Date() || access.revokedAt)
    return problemResponse(
      404,
      "SCOPE_UNAVAILABLE",
      "Scope unavailable",
      "The scope is unavailable."
    );

  let unsubscribe: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      unsubscribe = scopeBroadcast.subscribe(access, (invalidation) =>
        controller.enqueue(event(invalidation))
      );
    },
    cancel() {
      unsubscribe?.();
    }
  });
  return new Response(stream, {
    headers: {
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "x-accel-buffering": "no"
    }
  });
}
