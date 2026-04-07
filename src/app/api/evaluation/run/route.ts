import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluationRuns } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { runEvaluation } from "@/lib/evaluation/runner";
import { v4 as uuidv4 } from "uuid";

// Evaluation runs real OpenAI calls — allow up to 5 minutes
export const maxDuration = 300;

export async function POST() {
  const user = await requireAdmin();

  let evalResult;
  try {
    evalResult = await runEvaluation();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evaluation failed" },
      { status: 500 }
    );
  }

  const { metrics } = evalResult;
  const now = Math.floor(Date.now() / 1000);

  const runId = uuidv4();
  await db.insert(evaluationRuns).values({
    id: runId,
    ranAt: evalResult.ranAt,
    ranBy: user.id,
    sampleCount: evalResult.sampleCount,
    schemaValidityPct: metrics.schemaValidityPct,
    avgLlmMs: metrics.avgLlmMs,
    toolSuccessPct: metrics.toolSuccessPct,
    escalationPrecisionPct: metrics.escalationPrecisionPct,
    results: JSON.stringify(evalResult.results),
    createdAt: now,
  });

  return NextResponse.json({ runId, metrics, results: evalResult.results });
}
