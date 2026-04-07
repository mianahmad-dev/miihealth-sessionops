import { PipelineVoiceProvider } from "@/lib/voice/pipeline-provider";
import type { TurnTrace } from "@/lib/voice/types";
import { SAMPLE_SESSIONS, type SampleSession } from "./sample-sessions";
import { validateSummarySchema, computeMetrics } from "./metrics";
import type { EvalSampleResult, EvalMetrics } from "./metrics";

export interface EvalRunResult {
  ranAt: number;
  sampleCount: number;
  results: EvalSampleResult[];
  metrics: EvalMetrics;
}

export async function runEvaluation(): Promise<EvalRunResult> {
  const provider = new PipelineVoiceProvider();
  const results: EvalSampleResult[] = [];

  for (const sample of SAMPLE_SESSIONS) {
    const result = await runSample(provider, sample);
    results.push(result);
  }

  const metrics = computeMetrics(results);

  return {
    ranAt: Math.floor(Date.now() / 1000),
    sampleCount: SAMPLE_SESSIONS.length,
    results,
    metrics,
  };
}

async function runSample(
  provider: PipelineVoiceProvider,
  sample: SampleSession
): Promise<EvalSampleResult> {
  const startMs = Date.now();
  const traces: TurnTrace[] = [];
  const errors: string[] = [];

  try {
    const { sessionId } = await provider.startSession(sample.config);

    for (const turn of sample.turns) {
      const { trace } = await provider.sendText(sessionId, turn.userText);
      traces.push(trace);
    }

    const { summary, status } = await provider.endSession(sessionId);

    const schemaErrors = summary ? validateSummarySchema(summary) : ["Summary is null"];
    const hasEscalation =
      summary !== null &&
      Array.isArray(summary.escalation_flags) &&
      (summary.escalation_flags as unknown[]).length > 0;

    return {
      sampleId: sample.id,
      sampleName: sample.name,
      status,
      summary,
      schemaErrors,
      traces,
      totalMs: Date.now() - startMs,
      expectations: sample.expectations,
      escalationMatch: hasEscalation === sample.expectations.hasEscalation,
      qualityMatch:
        status === sample.expectations.sessionQuality ||
        (sample.expectations.sessionQuality === "needs_review" &&
          (status === "needs_review" || status === "failed")),
      errors,
    };
  } catch (err) {
    return {
      sampleId: sample.id,
      sampleName: sample.name,
      status: "failed",
      summary: null,
      schemaErrors: ["Session failed to run"],
      traces,
      totalMs: Date.now() - startMs,
      expectations: sample.expectations,
      escalationMatch: false,
      qualityMatch: false,
      errors: [err instanceof Error ? err.message : "Unknown error"],
    };
  }
}
