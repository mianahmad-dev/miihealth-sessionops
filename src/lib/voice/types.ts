export interface TranscriptEvent {
  speaker: "user" | "assistant" | "system";
  content: string;
  timestampMs: number;
}

export interface SessionResult {
  transcript: TranscriptEvent[];
  summary: Record<string, unknown> | null;
  status: "completed" | "failed" | "needs_review";
  errorReason?: string;
}

export interface StartSessionResult {
  sessionId: string;
  initialEvents: TranscriptEvent[];
}

// ─── Observability types ───────────────────────────────────────────────────────

export interface ToolInvocationTrace {
  toolName: string;
  args: Record<string, unknown>;
  result: string;
  durationMs: number;
  success: boolean;
}

export interface TurnTrace {
  llmMs: number;
  toolMs: number;
  totalMs: number;
  toolCallCount: number;
  toolInvocations: ToolInvocationTrace[];
  contextMessageCount: number;
  /** JSON-serialized array of messages sent to the model — for debug inspection */
  contextSnapshot: string;
}

export interface SendTextResult {
  events: TranscriptEvent[];
  trace: TurnTrace;
}

// ─── Provider config ───────────────────────────────────────────────────────────

export interface StartSessionConfig {
  purpose: string;
  language: string;
  voice: string;
  tools: string[];
  /** "full" keeps full history; "window" keeps last 20 messages (10 turns) */
  memoryMode?: "full" | "window";
}

export interface VoiceProvider {
  startSession(config: StartSessionConfig): Promise<StartSessionResult>;
  sendText(sessionId: string, userText: string): Promise<SendTextResult>;
  endSession(sessionId: string): Promise<SessionResult>;
}
