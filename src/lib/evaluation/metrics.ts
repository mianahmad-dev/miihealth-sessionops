import type { TurnTrace } from "@/lib/voice/types";
import type { SampleExpectations } from "./sample-sessions";

export interface EvalSampleResult {
  sampleId: string;
  sampleName: string;
  status: "completed" | "failed" | "needs_review";
  summary: Record<string, unknown> | null;
  schemaErrors: string[];
  traces: TurnTrace[];
  totalMs: number;
  expectations: SampleExpectations;
  /** Whether the escalation flag result matched expectation */
  escalationMatch: boolean;
  /** Whether the session_quality matched expectation */
  qualityMatch: boolean;
  errors: string[];
}

export interface EvalMetrics {
  /** % of sessions where summary JSON passes full schema validation */
  schemaValidityPct: number;
  /** % of collected_fields entries that were non-null across all sessions */
  fieldCompletionPct: number;
  /** % of tool invocations that succeeded across all sessions */
  toolSuccessPct: number;
  /** Precision of escalation flags: TP / (TP + FP), 0-100 */
  escalationPrecisionPct: number;
  /** Recall of escalation flags: TP / (TP + FN), 0-100 */
  escalationRecallPct: number;
  /** Mean LLM response time across all turns (ms) */
  avgLlmMs: number;
  /** Mean total turn time across all turns (ms) */
  avgTotalMs: number;
  /** Mean tool call time per invocation (ms), null if no tools called */
  avgToolMs: number | null;
}

const REQUIRED_SUMMARY_KEYS = [
  "chief_concern",
  "collected_fields",
  "missing_fields",
  "escalation_flags",
  "session_quality",
  "draft_notes",
] as const;

const REQUIRED_COLLECTED_FIELDS = [
  "name",
  "dob",
  "symptoms",
  "medications",
  "allergies",
  "insurance_id",
] as const;

const VALID_SESSION_QUALITIES = ["completed", "needs_review"] as const;

/** Returns an array of schema violations. Empty array = valid. */
export function validateSummarySchema(summary: Record<string, unknown>): string[] {
  const errors: string[] = [];

  for (const key of REQUIRED_SUMMARY_KEYS) {
    if (!(key in summary)) {
      errors.push(`Missing required key: "${key}"`);
    }
  }

  if ("collected_fields" in summary) {
    const cf = summary.collected_fields as Record<string, unknown>;
    if (typeof cf !== "object" || cf === null) {
      errors.push("collected_fields must be an object");
    } else {
      for (const field of REQUIRED_COLLECTED_FIELDS) {
        if (!(field in cf)) {
          errors.push(`collected_fields missing key: "${field}"`);
        }
      }
    }
  }

  if ("session_quality" in summary) {
    const q = summary.session_quality as string;
    if (!VALID_SESSION_QUALITIES.includes(q as (typeof VALID_SESSION_QUALITIES)[number])) {
      errors.push(`session_quality "${q}" is not valid; expected: ${VALID_SESSION_QUALITIES.join(" | ")}`);
    }
  }

  if ("escalation_flags" in summary && !Array.isArray(summary.escalation_flags)) {
    errors.push("escalation_flags must be an array");
  }

  if ("draft_notes" in summary && typeof summary.draft_notes === "string") {
    if (!summary.draft_notes.startsWith("DRAFT — For staff review only.")) {
      errors.push('draft_notes must start with "DRAFT — For staff review only."');
    }
  }

  return errors;
}

export function computeMetrics(results: EvalSampleResult[]): EvalMetrics {
  if (results.length === 0) {
    return {
      schemaValidityPct: 0,
      fieldCompletionPct: 0,
      toolSuccessPct: 0,
      escalationPrecisionPct: 0,
      escalationRecallPct: 0,
      avgLlmMs: 0,
      avgTotalMs: 0,
      avgToolMs: null,
    };
  }

  // Schema validity rate
  const validCount = results.filter((r) => r.schemaErrors.length === 0).length;
  const schemaValidityPct = Math.round((validCount / results.length) * 100);

  // Field completion rate (across all sessions that have a valid collected_fields)
  let totalFields = 0;
  let nonNullFields = 0;
  for (const r of results) {
    if (r.summary?.collected_fields && typeof r.summary.collected_fields === "object") {
      const cf = r.summary.collected_fields as Record<string, unknown>;
      for (const key of REQUIRED_COLLECTED_FIELDS) {
        totalFields++;
        if (cf[key] !== null && cf[key] !== undefined && cf[key] !== "") nonNullFields++;
      }
    }
  }
  const fieldCompletionPct = totalFields > 0 ? Math.round((nonNullFields / totalFields) * 100) : 0;

  // Tool success rate (across all tool invocations in all traces)
  let totalToolCalls = 0;
  let successfulToolCalls = 0;
  let totalToolMs = 0;
  for (const r of results) {
    for (const trace of r.traces) {
      for (const inv of trace.toolInvocations) {
        totalToolCalls++;
        if (inv.success) successfulToolCalls++;
        totalToolMs += inv.durationMs;
      }
    }
  }
  const toolSuccessPct =
    totalToolCalls > 0 ? Math.round((successfulToolCalls / totalToolCalls) * 100) : 100;
  const avgToolMs = totalToolCalls > 0 ? Math.round(totalToolMs / totalToolCalls) : null;

  // Escalation precision / recall
  // True positive: hasEscalation=true AND escalation detected
  // False positive: hasEscalation=false AND escalation detected
  // False negative: hasEscalation=true AND escalation NOT detected
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const r of results) {
    const detected =
      r.summary !== null &&
      Array.isArray(r.summary.escalation_flags) &&
      (r.summary.escalation_flags as unknown[]).length > 0;
    const expected = r.expectations.hasEscalation;
    if (detected && expected) tp++;
    else if (detected && !expected) fp++;
    else if (!detected && expected) fn++;
  }
  const escalationPrecisionPct =
    tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : 100; // vacuously perfect if no positives
  const escalationRecallPct =
    tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : 100;

  // Latency
  let totalLlmMs = 0;
  let totalTurnMs = 0;
  let turnCount = 0;
  for (const r of results) {
    for (const trace of r.traces) {
      totalLlmMs += trace.llmMs;
      totalTurnMs += trace.totalMs;
      turnCount++;
    }
  }
  const avgLlmMs = turnCount > 0 ? Math.round(totalLlmMs / turnCount) : 0;
  const avgTotalMs = turnCount > 0 ? Math.round(totalTurnMs / turnCount) : 0;

  return {
    schemaValidityPct,
    fieldCompletionPct,
    toolSuccessPct,
    escalationPrecisionPct,
    escalationRecallPct,
    avgLlmMs,
    avgTotalMs,
    avgToolMs,
  };
}
