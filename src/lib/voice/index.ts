import type { VoiceProvider } from "./types";
import { PipelineVoiceProvider } from "./pipeline-provider";

let _provider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (_provider) return _provider;
  _provider = new PipelineVoiceProvider();
  return _provider;
}

export type { VoiceProvider, TranscriptEvent, SessionResult } from "./types";
