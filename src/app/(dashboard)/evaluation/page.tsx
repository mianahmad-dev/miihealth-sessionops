import { requireAdmin } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { evaluationRuns } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { EvaluationClient } from "@/components/evaluation/evaluation-client";
import type { EvalSampleResult } from "@/lib/evaluation/metrics";

export default async function EvaluationPage() {
  await requireAdmin();

  const latest = await db
    .select()
    .from(evaluationRuns)
    .orderBy(desc(evaluationRuns.ranAt))
    .limit(1)
    .get();

  const latestRun = latest
    ? {
        ...latest,
        results: JSON.parse(latest.results) as EvalSampleResult[],
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Evaluation Harness</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Runs {latest ? "5" : "sample"} scripted sessions against the live pipeline and reports schema
          validity, latency, tool success, and escalation quality.
        </p>
      </div>

      <EvaluationClient latestRun={latestRun} />
    </div>
  );
}
