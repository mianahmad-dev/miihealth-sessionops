import type { VoiceProvider, TranscriptEvent, SessionResult } from "./types";

// Real pipeline: Deepgram STT → GPT-4o-mini → Browser SpeechSynthesis
// Requires DEEPGRAM_API_KEY and OPENAI_API_KEY env vars.
export class PipelineVoiceProvider implements VoiceProvider {
  async startSession(_config: {
    purpose: string;
    language: string;
    voice: string;
    tools: string[];
  }): Promise<string> {
    throw new Error(
      "Pipeline provider not yet implemented. Set VOICE_PROVIDER=mock or implement pipeline-provider."
    );
  }

  async sendAudio(_sessionId: string, _audioChunk: Blob): Promise<TranscriptEvent[]> {
    throw new Error("Pipeline provider not yet implemented.");
  }

  async endSession(_sessionId: string): Promise<SessionResult> {
    throw new Error("Pipeline provider not yet implemented.");
  }
}
