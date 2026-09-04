import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { ProblemDetails } from "./problem-details";
import { redactPublicText } from "@/server/observability/redaction";

export function problemResponse(
  status: number,
  code: string,
  title: string,
  detail: string,
  options: Partial<Pick<ProblemDetails, "retryable" | "fieldErrors" | "currentRevision">> = {}
) {
  const body: ProblemDetails = {
    type: `https://clientweave.example/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title: redactPublicText(title),
    status,
    detail: redactPublicText(detail),
    code,
    retryable: options.retryable ?? false,
    fieldErrors: options.fieldErrors ?? [],
    ...(options.currentRevision === undefined ? {} : { currentRevision: options.currentRevision }),
    traceId: randomUUID()
  };
  return NextResponse.json(body, {
    status,
    headers: { "content-type": "application/problem+json" }
  });
}
