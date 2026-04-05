import type { VoiceProvider } from "./types";
import { MockVoiceProvider } from "./mock-provider";

export function getVoiceProvider(): VoiceProvider {
  const provider = process.env.VOICE_PROVIDER ?? "mock";

  if (provider === "pipeline") {
    // Dynamically import to avoid loading Deepgram/OpenAI deps when using mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PipelineVoiceProvider } = require("./pipeline-provider") as {
      PipelineVoiceProvider: new () => VoiceProvider;
    };
    return new PipelineVoiceProvider();
  }

  return new MockVoiceProvider();
}

export type { VoiceProvider, TranscriptEvent, SessionResult } from "./types";
