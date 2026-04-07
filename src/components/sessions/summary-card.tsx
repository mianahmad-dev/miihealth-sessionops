
interface EscalationFlag {
  flag: string;
  evidence: string;
  severity: "high" | "medium" | "low";
}

interface SessionSummary {
  chief_concern?: string;
  collected_fields?: Record<string, string>;
  missing_fields?: string[];
  escalation_flags?: EscalationFlag[];
  session_quality?: string;
  draft_notes?: string;
}

const SEVERITY_BADGE: Record<
  EscalationFlag["severity"],
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  low: { label: "Low", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

interface SummaryCardProps {
  summaryJson: string | null;
}

export function SummaryCard({ summaryJson }: SummaryCardProps) {
  if (!summaryJson) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        No summary available.
      </div>
    );
  }

  let summary: SessionSummary;
  try {
    summary = JSON.parse(summaryJson) as SessionSummary;
  } catch {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Summary data is malformed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">Session Summary</h2>
        <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 border border-yellow-200">
          DRAFT — For staff review only
        </span>
      </div>

      <div className="rounded-lg border divide-y">
        {summary.chief_concern && (
          <div className="p-4 space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Chief Concern
            </div>
            <div className="text-sm">{summary.chief_concern}</div>
          </div>
        )}

        {summary.collected_fields && Object.keys(summary.collected_fields).length > 0 && (
          <div className="p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Collected Fields
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {Object.entries(summary.collected_fields).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}:</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {summary.missing_fields && summary.missing_fields.length > 0 && (
          <div className="p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Missing Fields
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summary.missing_fields.map((f) => (
                <span
                  key={f}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        {summary.draft_notes && (
          <div className="p-4 space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Draft Notes
            </div>
            <div className="text-sm leading-relaxed">{summary.draft_notes}</div>
          </div>
        )}
      </div>

      {summary.escalation_flags && summary.escalation_flags.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Escalation Flags</div>
          <div className="space-y-2">
            {summary.escalation_flags.map((flag, i) => {
              const sev = SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE.low;
              return (
                <div key={i} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium border ${sev.className}`}
                    >
                      {sev.label}
                    </span>
                    <span className="text-sm font-medium">{flag.flag}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{flag.evidence}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
