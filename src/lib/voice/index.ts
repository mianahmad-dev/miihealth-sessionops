import type { VoiceProvider } from "./types";
import { MockVoiceProvider } from "./mock-provider";

let _provider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (_provider) return _provider;

  const provider = process.env.VOICE_PROVIDER ?? "mock";

  if (provider === "pipeline") {
    // Dynamically import to avoid loading Deepgram/OpenAI deps when using mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PipelineVoiceProvider } = require("./pipeline-provider") as {
      PipelineVoiceProvider: new () => VoiceProvider;
    };
    _provider = new PipelineVoiceProvider();
  } else {
    _provider = new MockVoiceProvider();
  }

  return _provider;
}

export type { VoiceProvider, TranscriptEvent, SessionResult } from "./types";
