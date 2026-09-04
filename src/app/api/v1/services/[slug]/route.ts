import { NextRequest, NextResponse } from "next/server";
import { CatalogRepository } from "@/db/repositories/catalog-repository";
import { createRuntimeDatabase } from "@/db/client";
import { problemResponse } from "@/contracts/problems/to-problem-response";

export const runtime = "nodejs";

export async function GET(_: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  try {
    const service = (await new CatalogRepository(createRuntimeDatabase()).listPublicActive()).find(
      (candidate) => candidate.slug === slug
    );
    return service
      ? NextResponse.json(service)
      : problemResponse(
          404,
          "NOT_FOUND",
          "Service unavailable",
          "The requested service is not available."
        );
  } catch {
    return problemResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Service unavailable",
      "Please retry shortly.",
      { retryable: true }
    );
  }
}
