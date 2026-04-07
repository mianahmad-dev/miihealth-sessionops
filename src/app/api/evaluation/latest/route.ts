import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationRuns } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { desc } from "drizzle-orm";

export async function GET() {
  await requireAdmin();

  const latest = await db
    .select()
    .from(evaluationRuns)
    .orderBy(desc(evaluationRuns.ranAt))
    .limit(1)
    .get();

  if (!latest) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...latest,
    results: JSON.parse(latest.results) as unknown[],
  });
}
