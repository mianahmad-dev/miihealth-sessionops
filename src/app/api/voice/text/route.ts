import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, transcriptEvents, sessionTraces, toolInvocations } from "@/lib/db/schema";
import { getVoiceProvider } from "@/lib/voice";
import { getProviderSessionId } from "@/lib/voice/session-registry";
import { getCurrentUser } from "@/lib/auth/helpers";
import { v4 as uuidv4 } from "uuid";
import { eq, max } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { sessionId?: string; text?: string };
  const { sessionId, text } = body;

  if (!sessionId || !text?.trim()) {
    return NextResponse.json({ error: "Missing sessionId or text" }, { status: 400 });
  }

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session || (session.status !== "active" && session.status !== "initializing")) {
    return NextResponse.json({ error: "Session not active" }, { status: 400 });
  }

  // Ownership check
  if (user.role !== "admin" && session.operatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const providerSessionId = getProviderSessionId(sessionId);
  if (!providerSessionId) {
    return NextResponse.json({ error: "Provider session not found" }, { status: 404 });
  }

  const provider = getVoiceProvider();

  let sendResult;
  try {
    sendResult = await provider.sendText(providerSessionId, text.trim());
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }

  const { events, trace } = sendResult;
  const now = Math.floor(Date.now() / 1000);

  if (events.length > 0) {
    // Wrap transcript insert in a transaction to prevent sequenceNum races.
    // better-sqlite3 is synchronous — no async/await inside the callback.
    db.transaction((tx) => {
      const maxSeqResult = tx
        .select({ maxSeq: max(transcriptEvents.sequenceNum) })
        .from(transcriptEvents)
        .where(eq(transcriptEvents.sessionId, sessionId))
        .get();

      let nextSeq = (maxSeqResult?.maxSeq ?? -1) + 1;

      for (const event of events) {
        tx.insert(transcriptEvents).values({
          id: uuidv4(),
          sessionId,
          speaker: event.speaker,
          content: event.content,
          timestampMs: event.timestampMs,
          sequenceNum: nextSeq++,
          createdAt: now,
        }).run();
      }
    });
  }

  // Persist the turn trace (non-blocking, best-effort)
  const turnNum = Math.ceil(events.filter((e) => e.speaker === "user").length);
  try {
    await db.insert(sessionTraces).values({
      id: uuidv4(),
      sessionId,
      turnNum,
      llmMs: trace.llmMs,
      toolMs: trace.toolMs,
      totalMs: trace.totalMs,
      toolCallCount: trace.toolCallCount,
      contextMessageCount: trace.contextMessageCount,
      contextSnapshot: trace.contextSnapshot,
      createdAt: now,
    });

    for (const inv of trace.toolInvocations) {
      await db.insert(toolInvocations).values({
        id: uuidv4(),
        sessionId,
        turnNum,
        toolName: inv.toolName,
        args: JSON.stringify(inv.args),
        result: inv.result,
        durationMs: inv.durationMs,
        success: inv.success,
        createdAt: now,
      });
    }
  } catch {
    // Trace persistence failure must not fail the request
  }

  return NextResponse.json({ ok: true });
}
