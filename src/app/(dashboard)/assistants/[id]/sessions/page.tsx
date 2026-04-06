import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, assistants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { SessionTable, type SessionRow } from "@/components/sessions/session-table";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AssistantSessionsPage({ params }: Props) {
  const { id } = await params;
  await requireAuth();

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, id))
    .get();

  if (!assistant) notFound();

  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.assistantId, id))
    .orderBy(sessions.createdAt)
    .all();

  const sessionRows: SessionRow[] = rows
    .map((r) => ({
      id: r.id,
      assistantId: r.assistantId,
      assistantName: assistant.name,
      assistantVersion: r.assistantVersion,
      status: r.status,
      startedAt: r.startedAt,
      durationSec: r.durationSec,
      turnCount: r.turnCount,
    }))
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/assistants/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {assistant.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sessions — {assistant.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          All sessions launched with this assistant
        </p>
      </div>
      <SessionTable sessions={sessionRows} hideAssistantCol />
    </div>
  );
}
