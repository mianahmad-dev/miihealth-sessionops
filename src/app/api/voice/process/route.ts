import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, transcriptEvents } from "@/lib/db/schema";
import { getVoiceProvider } from "@/lib/voice";
import { getProviderSessionId } from "@/lib/voice/session-registry";
import { v4 as uuidv4 } from "uuid";
import { eq, max } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const sessionId = formData.get("sessionId") as string | null;
  const audioChunk = formData.get("audio") as Blob | null;

  if (!sessionId || !audioChunk) {
    return NextResponse.json({ error: "Missing sessionId or audio" }, { status: 400 });
  }

  const session = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session || (session.status !== "active" && session.status !== "initializing")) {
    return NextResponse.json({ error: "Session not active" }, { status: 400 });
  }

  const providerSessionId = getProviderSessionId(sessionId);
  if (!providerSessionId) {
    return NextResponse.json({ error: "Provider session not found" }, { status: 404 });
  }

  const provider = getVoiceProvider();
  const events = await provider.sendAudio(providerSessionId, audioChunk);

  if (events.length > 0) {
    const maxSeqResult = await db
      .select({ maxSeq: max(transcriptEvents.sequenceNum) })
      .from(transcriptEvents)
      .where(eq(transcriptEvents.sessionId, sessionId))
      .get();

    let nextSeq = (maxSeqResult?.maxSeq ?? -1) + 1;
    const now = Math.floor(Date.now() / 1000);

    for (const event of events) {
      await db.insert(transcriptEvents).values({
        id: uuidv4(),
        sessionId,
        speaker: event.speaker,
        content: event.content,
        timestampMs: event.timestampMs,
        sequenceNum: nextSeq++,
        createdAt: now,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
