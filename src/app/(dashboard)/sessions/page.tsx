import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, assistants, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { SessionTable, type SessionRow } from "@/components/sessions/session-table";
import { LaunchSessionDialog } from "@/components/sessions/launch-session-dialog";

export default async function SessionsPage() {
  const currentUser = await requireAuth();

  const [sessionRows_, publishedAssistants] = await Promise.all([
    (async () => {
      const query = db
        .select({
          id: sessions.id,
          assistantId: sessions.assistantId,
          assistantName: assistants.name,
          assistantVersion: sessions.assistantVersion,
          status: sessions.status,
          startedAt: sessions.startedAt,
          durationSec: sessions.durationSec,
          turnCount: sessions.turnCount,
          operatorName: users.name,
        })
        .from(sessions)
        .leftJoin(assistants, eq(sessions.assistantId, assistants.id))
        .leftJoin(users, eq(sessions.operatorId, users.id));

      return currentUser.role === "viewer"
        ? query.where(eq(sessions.operatorId, currentUser.id)).orderBy(sessions.createdAt)
        : query.orderBy(sessions.createdAt);
    })(),
    db
      .select({ id: assistants.id, name: assistants.name, language: assistants.language, voice: assistants.voice })
      .from(assistants)
      .where(eq(assistants.status, "published"))
      .all(),
  ]);

  const sessionRows: SessionRow[] = sessionRows_
    .map((r) => ({
      id: r.id,
      assistantId: r.assistantId,
      assistantName: r.assistantName ?? "Unknown",
      assistantVersion: r.assistantVersion,
      status: r.status,
      startedAt: r.startedAt,
      durationSec: r.durationSec,
      turnCount: r.turnCount,
      operatorName: currentUser.role === "admin" ? (r.operatorName ?? "Unknown") : undefined,
    }))
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">Session history and recordings</p>
        </div>
        <LaunchSessionDialog assistants={publishedAssistants} />
      </div>
      <SessionTable sessions={sessionRows} />
    </div>
  );
}
