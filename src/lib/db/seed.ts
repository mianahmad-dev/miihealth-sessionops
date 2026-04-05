import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { hashSync } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "./sessionops.db";
const sqlite = new Database(DATABASE_URL);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema });

async function seed() {
  const now = Math.floor(Date.now() / 1000);

  // Users
  const adminId = uuidv4();
  const viewerId = uuidv4();

  await db.insert(schema.users).values([
    {
      id: adminId,
      email: "admin@sessionops.local",
      name: "Admin User",
      role: "admin",
      passwordHash: hashSync("admin123", 10),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: viewerId,
      email: "viewer@sessionops.local",
      name: "Viewer User",
      role: "viewer",
      passwordHash: hashSync("viewer123", 10),
      createdAt: now,
      updatedAt: now,
    },
  ]).onConflictDoNothing();

  // Assistants
  const publishedAssistantId = uuidv4();
  const draftAssistantId = uuidv4();

  await db.insert(schema.assistants).values([
    {
      id: publishedAssistantId,
      name: "General Intake Assistant",
      purpose:
        "You are a healthcare intake assistant. Collect patient name, date of birth, chief complaint, and insurance information. Ask one question at a time in a friendly, professional manner.",
      language: "en",
      voice: "professional",
      status: "published",
      tools: JSON.stringify(["symptom_lookup", "form_prefill"]),
      version: 2,
      createdBy: adminId,
      createdAt: now - 86400 * 7,
      updatedAt: now - 86400 * 2,
    },
    {
      id: draftAssistantId,
      name: "Cardiology Pre-Screen",
      purpose:
        "You are a cardiac intake specialist. Screen patients for cardiology appointments by asking about chest pain, shortness of breath, family history, and current medications.",
      language: "en",
      voice: "clinical",
      status: "draft",
      tools: JSON.stringify(["symptom_lookup", "appointment_check"]),
      version: 1,
      createdBy: adminId,
      createdAt: now - 86400 * 3,
      updatedAt: now - 86400 * 3,
    },
  ]).onConflictDoNothing();

  // Completed session
  const sessionId = uuidv4();
  const sessionStart = now - 3600;
  const sessionEnd = sessionStart + 420;

  const summary = {
    chief_concern: "Persistent chest discomfort and shortness of breath",
    collected_fields: {
      name: "John Smith",
      dob: "1975-04-12",
      symptoms: "chest pressure, shortness of breath on exertion",
    },
    missing_fields: ["insurance_id", "allergies", "current_medications"],
    escalation_flags: [
      {
        flag: "Patient mentioned chest pain",
        evidence: "Turn 4: 'I've been having this pressure in my chest for about a week'",
        severity: "high",
      },
    ],
    session_quality: "needs_review",
    draft_notes:
      "Patient intake partially complete. Escalation flag raised for chest pain mention. Recommend clinical follow-up before appointment.",
  };

  await db.insert(schema.sessions).values({
    id: sessionId,
    assistantId: publishedAssistantId,
    assistantVersion: 2,
    operatorId: viewerId,
    status: "needs_review",
    startedAt: sessionStart,
    endedAt: sessionEnd,
    durationSec: sessionEnd - sessionStart,
    turnCount: 9,
    summary: JSON.stringify(summary),
    createdAt: sessionStart,
  }).onConflictDoNothing();

  // Transcript events
  const turns: Array<{
    speaker: "user" | "assistant" | "system";
    content: string;
    ms: number;
  }> = [
    { speaker: "system", content: "Session started", ms: 0 },
    {
      speaker: "assistant",
      content: "Hello! I'm here to help with your intake today. May I start with your full name?",
      ms: 800,
    },
    { speaker: "user", content: "Yes, my name is John Smith.", ms: 5200 },
    {
      speaker: "assistant",
      content: "Thank you, John. And what is your date of birth?",
      ms: 6100,
    },
    { speaker: "user", content: "April 12th, 1975.", ms: 11400 },
    {
      speaker: "assistant",
      content: "Got it. What brings you in today — what is your main concern?",
      ms: 12200,
    },
    {
      speaker: "user",
      content: "I've been having this pressure in my chest for about a week, and I get short of breath when I walk up stairs.",
      ms: 22800,
    },
    {
      speaker: "assistant",
      content: "I understand. That sounds uncomfortable. Do you have any known allergies or are you currently taking any medications?",
      ms: 24500,
    },
    {
      speaker: "user",
      content: "I don't think I have any allergies, but I'm not sure about my medications — I'd have to check.",
      ms: 35100,
    },
    {
      speaker: "assistant",
      content: "No problem. I've noted that. Could you also provide your insurance ID number?",
      ms: 36200,
    },
  ];

  const eventRows = turns.map((t, i) => ({
    id: uuidv4(),
    sessionId,
    speaker: t.speaker,
    content: t.content,
    timestampMs: t.ms,
    sequenceNum: i,
    createdAt: sessionStart + Math.floor(t.ms / 1000),
  }));

  await db.insert(schema.transcriptEvents).values(eventRows).onConflictDoNothing();

  // Audit logs
  await db.insert(schema.auditLogs).values([
    {
      id: uuidv4(),
      userId: adminId,
      action: "create",
      entityType: "assistant",
      entityId: publishedAssistantId,
      changes: null,
      createdAt: now - 86400 * 7,
    },
    {
      id: uuidv4(),
      userId: adminId,
      action: "publish",
      entityType: "assistant",
      entityId: publishedAssistantId,
      changes: JSON.stringify({ status: { from: "draft", to: "published" } }),
      createdAt: now - 86400 * 5,
    },
    {
      id: uuidv4(),
      userId: adminId,
      action: "update",
      entityType: "assistant",
      entityId: publishedAssistantId,
      changes: JSON.stringify({ version: { from: 1, to: 2 } }),
      createdAt: now - 86400 * 2,
    },
    {
      id: uuidv4(),
      userId: adminId,
      action: "create",
      entityType: "assistant",
      entityId: draftAssistantId,
      changes: null,
      createdAt: now - 86400 * 3,
    },
  ]).onConflictDoNothing();

  console.log("Seed complete.");
  sqlite.close();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
