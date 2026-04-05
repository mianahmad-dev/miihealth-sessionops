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

export interface VoiceProvider {
  startSession(assistantConfig: {
    purpose: string;
    language: string;
    voice: string;
    tools: string[];
  }): Promise<string>;
  sendAudio(sessionId: string, audioChunk: Blob): Promise<TranscriptEvent[]>;
  endSession(sessionId: string): Promise<SessionResult>;
}
