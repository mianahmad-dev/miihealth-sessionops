import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, assistants, transcriptEvents } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/helpers";
import { getVoiceProvider } from "@/lib/voice";
import { registerSession } from "@/lib/voice/session-registry";
import { cleanupStaleSessions } from "@/lib/cleanup";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lazily clean up stale sessions on each new session creation
  void cleanupStaleSessions();

  const body = (await req.json()) as { assistantId?: string };
  const { assistantId } = body;

  if (!assistantId) {
    return NextResponse.json({ error: "assistantId is required" }, { status: 400 });
  }

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .get();

  if (!assistant) {
    return NextResponse.json({ error: "Assistant not found" }, { status: 404 });
  }
  if (assistant.status !== "published") {
    return NextResponse.json({ error: "Assistant must be published to launch sessions" }, { status: 400 });
  }

  const provider = getVoiceProvider();
  const tools: string[] = assistant.tools ? (JSON.parse(assistant.tools) as string[]) : [];

  // startSession runs in Route Handler context — same module instance as
  // /api/voice/process and /api/sessions/[id]/end, so activeSessions Map is shared.
  const { sessionId: providerSessionId, initialEvents } = await provider.startSession({
    purpose: assistant.purpose,
    language: assistant.language,
    voice: assistant.voice,
    tools,
    memoryMode: (assistant.memoryMode as "full" | "window") ?? "full",
  });

  const sessionId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(sessions).values({
    id: sessionId,
    assistantId,
    assistantVersion: assistant.version,
    operatorId: user.id,
    status: "initializing",
    startedAt: now,
    createdAt: now,
  });

  // Save all initial events from provider to DB so SSE picks them up
  let seq = 0;
  for (const event of initialEvents) {
    await db.insert(transcriptEvents).values({
      id: uuidv4(),
      sessionId,
      speaker: event.speaker,
      content: event.content,
      timestampMs: event.timestampMs,
      sequenceNum: seq++,
      createdAt: now,
    });
  }

  // Register the mapping: DB session ID → provider session ID
  registerSession(sessionId, providerSessionId);

  return NextResponse.json({ sessionId });
}
