import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, assistants, transcriptEvents } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { Badge } from "@/components/ui/badge";
import { SummaryCard } from "@/components/sessions/summary-card";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
};

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  initializing: { label: "Initializing", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  ending: { label: "Ending", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
  needs_review: { label: "Needs Review", variant: "destructive" },
};

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString();
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default async function SessionReviewPage({ params }: Props) {
  const { id } = await params;
  await requireAuth();

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .get();

  if (!session) notFound();

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, session.assistantId))
    .get();

  const events = await db
    .select()
    .from(transcriptEvents)
    .where(eq(transcriptEvents.sessionId, id))
    .orderBy(transcriptEvents.sequenceNum)
    .all();

  const badge = STATUS_BADGE[session.status] ?? { label: session.status, variant: "secondary" };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to sessions
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Session Review</h1>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </div>

      {session.status === "needs_review" && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium text-yellow-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This session requires human review
        </div>
      )}

      {session.status === "failed" && session.errorReason && (
        <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Session failed: </span>
            {session.errorReason}
          </div>
        </div>
      )}

      {/* Metadata card */}
      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x">
          <MetaField label="Assistant" value={assistant?.name ?? "Unknown"} />
          <MetaField label="Version" value={`v${session.assistantVersion}`} />
          <MetaField label="Duration" value={formatDuration(session.durationSec)} />
          <MetaField label="Turns" value={String(session.turnCount ?? 0)} />
        </div>
        <div className="grid grid-cols-2 divide-x">
          <MetaField label="Started" value={formatDate(session.startedAt)} />
          <MetaField label="Ended" value={formatDate(session.endedAt)} />
        </div>
      </div>

      {/* Transcript */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Transcript</h2>
        {events.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-8">
            <p className="text-sm text-muted-foreground">No transcript events recorded.</p>
          </div>
        ) : (
          <div className="rounded-lg border bg-background p-4 space-y-3">
            {events.map((event) => {
              if (event.speaker === "system") {
                return (
                  <div key={event.id} className="flex justify-center py-1">
                    <span className="text-xs text-muted-foreground italic">{event.content}</span>
                  </div>
                );
              }

              const isUser = event.speaker === "user";
              return (
                <div
                  key={event.id}
                  className={cn("flex gap-2 items-start", isUser ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
                      isUser
                        ? "bg-blue-100 text-blue-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {isUser ? "P" : "A"}
                  </div>
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-3 py-2 space-y-1",
                      isUser ? "bg-blue-50 text-blue-900" : "bg-green-50 text-green-900"
                    )}
                  >
                    <p className="text-sm leading-relaxed">{event.content}</p>
                    <p className="text-xs opacity-50">{formatMs(event.timestampMs)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <SummaryCard summaryJson={session.summary} />
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
