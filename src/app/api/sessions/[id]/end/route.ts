import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, transcriptEvents } from "@/lib/db/schema";
import { getVoiceProvider } from "@/lib/voice";
import { getProviderSessionId, unregisterSession } from "@/lib/voice/session-registry";
import { getCurrentUser } from "@/lib/auth/helpers";
import { v4 as uuidv4 } from "uuid";
import { eq, max, and, sql } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (user.role !== "admin" && session.operatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    session.status === "completed" ||
    session.status === "failed" ||
    session.status === "needs_review"
  ) {
    return NextResponse.json({ status: session.status, sessionId });
  }

  await db.update(sessions).set({ status: "ending" }).where(eq(sessions.id, sessionId));

  const providerSessionId = getProviderSessionId(sessionId);
  if (!providerSessionId) {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(sessions)
      .set({ status: "failed", errorReason: "Provider session not found", endedAt: now })
      .where(eq(sessions.id, sessionId));
    return NextResponse.json({ status: "failed", errorReason: "Provider session not found" });
  }

  const provider = getVoiceProvider();

  try {
    const result = await provider.endSession(providerSessionId);
    unregisterSession(sessionId);

    const now = Math.floor(Date.now() / 1000);
    const endedAt = now;
    const durationSec = session.startedAt ? endedAt - session.startedAt : 0;

    const maxSeqResult = await db
      .select({ maxSeq: max(transcriptEvents.sequenceNum) })
      .from(transcriptEvents)
      .where(eq(transcriptEvents.sessionId, sessionId))
      .get();

    const nextSeq = (maxSeqResult?.maxSeq ?? -1) + 1;

    await db.insert(transcriptEvents).values({
      id: uuidv4(),
      sessionId,
      speaker: "system",
      content: "Session ended.",
      timestampMs: durationSec * 1000,
      sequenceNum: nextSeq,
      createdAt: now,
    });

    const turnCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(transcriptEvents)
      .where(
        and(
          eq(transcriptEvents.sessionId, sessionId),
          eq(transcriptEvents.speaker, "user")
        )
      )
      .get();

    const turnCount = turnCountResult?.count ?? 0;

    await db
      .update(sessions)
      .set({
        status: result.status,
        endedAt,
        durationSec,
        turnCount,
        summary: result.summary ? JSON.stringify(result.summary) : null,
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({ status: result.status, sessionId });
  } catch (error) {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorReason: error instanceof Error ? error.message : "Unknown error",
        endedAt: now,
      })
      .where(eq(sessions.id, sessionId));

    return NextResponse.json({ status: "failed" });
  }
}
