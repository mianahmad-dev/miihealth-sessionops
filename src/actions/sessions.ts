"use server";

import { db } from "@/lib/db";
import { sessions, assistants, transcriptEvents } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { getVoiceProvider } from "@/lib/voice";
import { registerSession } from "@/lib/voice/session-registry";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

export async function createSession(assistantId: string): Promise<{ sessionId: string }> {
  const user = await requireAuth();

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .get();

  if (!assistant) throw new Error("Assistant not found");
  if (assistant.status !== "published") {
    throw new Error("Assistant must be published to launch sessions");
  }

  const provider = getVoiceProvider();
  const tools: string[] = assistant.tools ? (JSON.parse(assistant.tools) as string[]) : [];

  const providerSessionId = await provider.startSession({
    purpose: assistant.purpose,
    language: assistant.language,
    voice: assistant.voice,
    tools,
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

  await db.insert(transcriptEvents).values({
    id: uuidv4(),
    sessionId,
    speaker: "system",
    content: `Session started with ${assistant.name} (v${assistant.version})`,
    timestampMs: 0,
    sequenceNum: 0,
    createdAt: now,
  });

  registerSession(sessionId, providerSessionId);

  return { sessionId };
}

export async function updateSessionStatus(
  sessionId: string,
  status: "active" | "ending"
): Promise<void> {
  await requireAuth();
  await db.update(sessions).set({ status }).where(eq(sessions.id, sessionId));
}
