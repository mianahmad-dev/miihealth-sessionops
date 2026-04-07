import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "viewer"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const assistants = sqliteTable("assistants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  purpose: text("purpose").notNull(),
  language: text("language").notNull().default("en"),
  voice: text("voice").notNull().default("default"),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  tools: text("tools"),
  memoryMode: text("memory_mode", { enum: ["full", "window"] })
    .notNull()
    .default("full"),
  version: integer("version").notNull().default(1),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  assistantId: text("assistant_id")
    .notNull()
    .references(() => assistants.id),
  assistantVersion: integer("assistant_version").notNull(),
  operatorId: text("operator_id")
    .notNull()
    .references(() => users.id),
  status: text("status", {
    enum: ["initializing", "active", "ending", "completed", "failed", "needs_review"],
  }).notNull(),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
  durationSec: integer("duration_sec"),
  turnCount: integer("turn_count").default(0),
  summary: text("summary"),
  errorReason: text("error_reason"),
  createdAt: integer("created_at").notNull(),
});

export const transcriptEvents = sqliteTable("transcript_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  speaker: text("speaker", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  timestampMs: integer("timestamp_ms").notNull(),
  sequenceNum: integer("sequence_num").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action", {
    enum: ["create", "update", "publish", "archive", "duplicate"],
  }).notNull(),
  entityType: text("entity_type", { enum: ["assistant", "session"] }).notNull(),
  entityId: text("entity_id").notNull(),
  changes: text("changes"),
  createdAt: integer("created_at").notNull(),
});

// ─── AI observability: per-turn LLM/tool timing ──────────────────────────────

export const sessionTraces = sqliteTable("session_traces", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  turnNum: integer("turn_num").notNull(),
  llmMs: integer("llm_ms").notNull(),
  toolMs: integer("tool_ms").notNull().default(0),
  totalMs: integer("total_ms").notNull(),
  toolCallCount: integer("tool_call_count").notNull().default(0),
  contextMessageCount: integer("context_message_count").notNull(),
  // JSON snapshot of messages sent to the model — for debug inspection
  contextSnapshot: text("context_snapshot"),
  createdAt: integer("created_at").notNull(),
});

export const toolInvocations = sqliteTable("tool_invocations", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id),
  turnNum: integer("turn_num").notNull(),
  toolName: text("tool_name").notNull(),
  args: text("args").notNull(),   // JSON
  result: text("result"),          // JSON — null if call failed before returning
  durationMs: integer("duration_ms").notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

// ─── Evaluation harness results ───────────────────────────────────────────────

export const evaluationRuns = sqliteTable("evaluation_runs", {
  id: text("id").primaryKey(),
  ranAt: integer("ran_at").notNull(),
  ranBy: text("ran_by").references(() => users.id),
  sampleCount: integer("sample_count").notNull(),
  // Metrics stored as integers (0-100 for percentages, raw ms for latency)
  schemaValidityPct: integer("schema_validity_pct"),
  avgLlmMs: integer("avg_llm_ms"),
  toolSuccessPct: integer("tool_success_pct"),
  escalationPrecisionPct: integer("escalation_precision_pct"),
  // Full JSON blob with per-sample detail
  results: text("results").notNull(),
  createdAt: integer("created_at").notNull(),
});
