import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, assistants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { SessionTable, type SessionRow } from "@/components/sessions/session-table";

export default async function SessionsPage() {
  await requireAuth();

  const rows = await db
    .select({
      id: sessions.id,
      assistantId: sessions.assistantId,
      assistantName: assistants.name,
      assistantVersion: sessions.assistantVersion,
      status: sessions.status,
      startedAt: sessions.startedAt,
      durationSec: sessions.durationSec,
      turnCount: sessions.turnCount,
    })
    .from(sessions)
    .leftJoin(assistants, eq(sessions.assistantId, assistants.id))
    .orderBy(sessions.createdAt);

  const sessionRows: SessionRow[] = rows.map((r) => ({
    id: r.id,
    assistantId: r.assistantId,
    assistantName: r.assistantName ?? "Unknown",
    assistantVersion: r.assistantVersion,
    status: r.status,
    startedAt: r.startedAt,
    durationSec: r.durationSec,
    turnCount: r.turnCount,
  }));

  // Sort most recent first
  sessionRows.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">Session history and recordings</p>
      </div>
      <SessionTable sessions={sessionRows} />
    </div>
  );
}
