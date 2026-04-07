"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { EvalSampleResult, EvalMetrics } from "@/lib/evaluation/metrics";

interface StoredRun {
  id: string;
  ranAt: number;
  sampleCount: number;
  schemaValidityPct: number | null;
  avgLlmMs: number | null;
  toolSuccessPct: number | null;
  escalationPrecisionPct: number | null;
  results: EvalSampleResult[];
}

interface Props {
  latestRun: StoredRun | null;
}

function MetricCard({ label, value, unit = "%" }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">
        {value === null || value === undefined ? "—" : `${value}${unit}`}
      </div>
    </div>
  );
}

function SampleRow({ result }: { result: EvalSampleResult }) {
  const [open, setOpen] = useState(false);
  const valid = result.schemaErrors.length === 0;
  const turnCount = result.traces.length;
  const avgLlm =
    turnCount > 0
      ? Math.round(result.traces.reduce((s, t) => s + t.llmMs, 0) / turnCount)
      : 0;

  return (
    <div className="rounded-md border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              result.errors.length > 0
                ? "bg-destructive"
                : valid
                ? "bg-green-500"
                : "bg-yellow-500"
            }`}
          />
          <span className="text-sm font-medium">{result.sampleName}</span>
          <span className="text-xs text-muted-foreground">
            {turnCount} turn{turnCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{valid ? "schema ✓" : `schema ✗ (${result.schemaErrors.length})`}</span>
          <span>{result.escalationMatch ? "escalation ✓" : "escalation ✗"}</span>
          <span>{avgLlm}ms avg</span>
          <span className="text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3 bg-muted/20 text-sm">
          {result.errors.length > 0 && (
            <div className="text-destructive font-medium">
              Error: {result.errors.join("; ")}
            </div>
          )}

          {result.schemaErrors.length > 0 && (
            <div>
              <div className="font-medium text-yellow-700 dark:text-yellow-400">Schema violations</div>
              <ul className="mt-1 list-disc ml-4 text-xs text-muted-foreground space-y-0.5">
                {result.schemaErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="font-medium">Per-turn timing</div>
            <div className="mt-1 overflow-x-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-1 pr-4">Turn</th>
                    <th className="text-right pr-4">LLM ms</th>
                    <th className="text-right pr-4">Tool ms</th>
                    <th className="text-right pr-4">Total ms</th>
                    <th className="text-right">Context msgs</th>
                  </tr>
                </thead>
                <tbody>
                  {result.traces.map((t, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="text-right pr-4 tabular-nums">{t.llmMs}</td>
                      <td className="text-right pr-4 tabular-nums">{t.toolMs}</td>
                      <td className="text-right pr-4 tabular-nums">{t.totalMs}</td>
                      <td className="text-right tabular-nums">{t.contextMessageCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {result.traces.some((t) => t.toolInvocations.length > 0) && (
            <div>
              <div className="font-medium">Tool invocations</div>
              <div className="mt-1 space-y-1">
                {result.traces.flatMap((t, ti) =>
                  t.toolInvocations.map((inv, ii) => (
                    <div key={`${ti}-${ii}`} className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-mono px-1 rounded ${
                          inv.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {inv.toolName}
                      </span>
                      <span className="text-muted-foreground">{inv.durationMs}ms</span>
                      <span>{inv.success ? "✓" : "✗"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {result.summary && (
            <div>
              <div className="font-medium">Summary (session_quality: {String(result.summary.session_quality ?? "—")})</div>
              {Array.isArray(result.summary.escalation_flags) &&
                (result.summary.escalation_flags as unknown[]).length > 0 && (
                  <div className="mt-1 space-y-1">
                    {(result.summary.escalation_flags as Array<{ flag: string; severity: string; evidence: string }>).map(
                      (f, i) => (
                        <div key={i} className="text-xs rounded border border-destructive/30 bg-destructive/5 px-2 py-1">
                          <span className="font-medium text-destructive">[{f.severity}]</span>{" "}
                          {f.flag}
                          {f.evidence && (
                            <span className="block text-muted-foreground mt-0.5">
                              Evidence: &ldquo;{f.evidence}&rdquo;
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EvaluationClient({ latestRun }: Props) {
  const [isPending, startTransition] = useTransition();
  const [run, setRun] = useState<StoredRun | null>(latestRun);
  const [runError, setRunError] = useState<string | null>(null);

  function handleRun() {
    setRunError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/evaluation/run", { method: "POST" });
        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          setRunError(body.error ?? "Evaluation failed");
          return;
        }
        const data = (await res.json()) as {
          runId: string;
          metrics: EvalMetrics;
          results: EvalSampleResult[];
        };
        setRun({
          id: data.runId,
          ranAt: Math.floor(Date.now() / 1000),
          sampleCount: data.results.length,
          schemaValidityPct: data.metrics.schemaValidityPct,
          avgLlmMs: data.metrics.avgLlmMs,
          toolSuccessPct: data.metrics.toolSuccessPct,
          escalationPrecisionPct: data.metrics.escalationPrecisionPct,
          results: data.results,
        });
      } catch {
        setRunError("Network error — evaluation could not be started");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {run
            ? `Last run: ${new Date(run.ranAt * 1000).toLocaleString()} · ${run.sampleCount} samples`
            : "No evaluation runs yet"}
        </div>
        <Button onClick={handleRun} disabled={isPending}>
          {isPending ? "Running…" : "Run Evaluation"}
        </Button>
      </div>

      {isPending && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <div>
            <div className="text-sm font-medium">Running evaluation…</div>
            <div className="text-xs text-muted-foreground">
              This calls the live OpenAI pipeline for each sample session and may take 1–3 minutes.
            </div>
          </div>
        </div>
      )}

      {runError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {runError}
        </div>
      )}

      {run && !isPending && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Schema Validity" value={run.schemaValidityPct} />
            <MetricCard label="Avg LLM Latency" value={run.avgLlmMs} unit="ms" />
            <MetricCard label="Tool Success" value={run.toolSuccessPct} />
            <MetricCard label="Escalation Precision" value={run.escalationPrecisionPct} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Per-sample results</h2>
            {run.results.map((r) => (
              <SampleRow key={r.sampleId} result={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
