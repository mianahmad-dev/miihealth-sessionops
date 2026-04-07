"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TranscriptViewer, type TranscriptRow } from "@/components/sessions/transcript-viewer";
import { updateSessionStatus } from "@/actions/sessions";

// BCP-47 tags for SpeechSynthesis & SpeechRecognition
const LANG_BCP47: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
};

// Pick the best available TTS voice for a language.
// Priority: cloud/online (Google, MS Online) > decent local > any matching
function pickVoice(voices: SpeechSynthesisVoice[], bcp47: string): SpeechSynthesisVoice | null {
  const prefix = bcp47.split("-")[0].toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (candidates.length === 0) return null;
  const cloud = candidates.find((v) => !v.localService);
  if (cloud) return cloud;
  const decent = candidates.find((v) => !/espeak|compact|microsoft sam/i.test(v.name));
  return decent ?? candidates[0];
}

// Minimal SpeechRecognition type shim — not in TS lib by default
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
}

type UIStatus =
  | "mic_denied"
  | "initializing"
  | "active"
  | "ending"
  | "failed";

interface Props {
  assistantId: string;
  assistantName: string;
  assistantLanguage: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LiveSession({ assistantId, assistantName, assistantLanguage }: Props) {
  const router = useRouter();
  const [uiStatus, setUiStatus] = useState<UIStatus>("initializing");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastSpeaker, setLastSpeaker] = useState<"user" | "assistant" | null>(null);
  const [interimText, setInterimText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  // TTS state
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const ttsActiveRef = useRef(false);

  // Preload TTS voices — getVoices() returns [] on first call in most browsers
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) voicesRef.current = v;
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  // Timer — only ticks when active
  useEffect(() => {
    if (uiStatus !== "active") return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [uiStatus]);

  // SSE connection — opens when sessionId is set
  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.addEventListener("transcript", (e) => {
      const event = JSON.parse(e.data) as TranscriptRow;
      setTranscript((prev) => {
        if (prev.some((t) => t.id === event.id)) return prev;
        return [...prev, event];
      });
      if (event.speaker !== "system") setLastSpeaker(event.speaker);

      // TTS — deduplicated by event ID to prevent replay on SSE reconnect
      if (
        event.speaker === "assistant" &&
        !spokenIdsRef.current.has(event.id) &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        spokenIdsRef.current.add(event.id);
        const bcp47 = LANG_BCP47[assistantLanguage] ?? "en-US";
        const utterance = new SpeechSynthesisUtterance(event.content);
        utterance.lang = bcp47;
        utterance.rate = 1.05;
        const bestVoice = pickVoice(voicesRef.current, bcp47);
        if (bestVoice) utterance.voice = bestVoice;

        // Abort recognition immediately — stop() still processes buffered audio
        // which causes the assistant's voice to be transcribed as user speech
        ttsActiveRef.current = true;
        recognitionRef.current?.abort();

        utterance.onend = () => {
          // Small delay to let speaker output fully decay before mic reopens
          setTimeout(() => {
            ttsActiveRef.current = false;
            try { recognitionRef.current?.start(); } catch { /* already running */ }
          }, 400);
        };

        window.speechSynthesis.speak(utterance);
      }
    });

    es.addEventListener("end", (e) => {
      const data = JSON.parse(e.data) as { status: string; sessionId: string };
      es.close();
      window.speechSynthesis?.cancel();
      if (data.status === "completed" || data.status === "needs_review") {
        router.push(`/sessions/${sessionId}`);
      } else {
        setUiStatus("failed");
        setError("Session ended with an error");
      }
    });

    es.onerror = () => es.close();
    return () => {
      es.close();
      window.speechSynthesis?.cancel();
    };
  }, [sessionId, router, assistantLanguage]);

  // ─── Web Speech API (SpeechRecognition) ────────────────────────────────────
  // Chrome stops recognition after silence — onend handler restarts it unless
  // TTS is active (to avoid echo) or the session is being torn down.
  useEffect(() => {
    if (uiStatus !== "active") return;

    const SpeechRecognitionCtor = (
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition
    );

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      setUiStatus("failed");
      return;
    }

    let stopped = false;
    const bcp47 = LANG_BCP47[assistantLanguage] ?? "en-US";

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = bcp47;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            setInterimText("");
            void handleSendText(text);
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "permission-denied") {
        stopped = true;
        setUiStatus("mic_denied");
      }
      // Other errors (network, no-speech, aborted) — let onend handle restart
    };

    recognition.onend = () => {
      // Auto-restart unless we're torn down or TTS is speaking
      if (!stopped && !ttsActiveRef.current) {
        try { recognition.start(); } catch { /* already starting */ }
      }
    };

    try {
      recognition.start();
    } catch {
      // Already started
    }

    return () => {
      stopped = true;
      recognition.abort();
      recognitionRef.current = null;
      setInterimText("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiStatus]);

  async function handleSendText(text: string) {
    const sid = sessionIdRef.current;
    if (!sid) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/voice/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, text }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(`Turn failed: ${body.error ?? res.statusText}. The turn was not saved.`);
      }
    } catch {
      setError("Network error — this turn was not saved. Check your connection and continue speaking.");
    } finally {
      setIsSending(false);
    }
  }

  // ─── Session startup ────────────────────────────────────────────────────────
  // AbortController prevents React Strict Mode from creating two sessions.
  // Strict Mode runs effects twice in dev: mount → cleanup → mount.
  // The cleanup aborts the first run before it can create a session; the second
  // run proceeds normally and creates exactly one session.
  useEffect(() => {
    const controller = new AbortController();

    async function start() {
      try {
        const res = await fetch("/api/sessions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assistantId }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        const body = (await res.json()) as { sessionId?: string; error?: string };

        if (!res.ok) {
          throw new Error(body.error ?? "Failed to start session");
        }

        const sid = body.sessionId!;
        setSessionId(sid);
        sessionIdRef.current = sid;

        await updateSessionStatus(sid, "active");
        if (controller.signal.aborted) return;

        startTimeRef.current = Date.now();
        setUiStatus("active");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to start session");
        setUiStatus("failed");
      }
    }

    start();

    return () => {
      controller.abort();
      eventSourceRef.current?.close();
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEndSession() {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setUiStatus("ending");
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    eventSourceRef.current?.close();

    await updateSessionStatus(sid, "ending");

    try {
      const res = await fetch(`/api/sessions/${sid}/end`, { method: "POST" });
      const data = (await res.json()) as { status: string };

      if (data.status === "completed" || data.status === "needs_review") {
        router.push(`/sessions/${sid}`);
      } else {
        setUiStatus("failed");
        setError("Session ended with an error");
      }
    } catch {
      setUiStatus("failed");
      setError("Failed to end session");
    }
  }

  // ─── Render states ──────────────────────────────────────────────────────────

  if (uiStatus === "mic_denied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Microphone Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Allow microphone access in your browser settings, then click Retry.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (uiStatus === "initializing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Connecting…</p>
      </div>
    );
  }

  if (uiStatus === "ending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Saving session…</p>
      </div>
    );
  }

  if (uiStatus === "failed") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-destructive">Session Failed</h2>
          <p className="text-sm text-muted-foreground">{error ?? "An unexpected error occurred"}</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/assistants")}>
          Back to Assistants
        </Button>
      </div>
    );
  }

  // active
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">{assistantName}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
            <span className="tabular-nums">{formatTime(elapsed)}</span>
          </div>
        </div>
        <Button variant="destructive" onClick={handleEndSession}>
          End Session
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="h-6">
        {isSending ? (
          <p className="text-sm text-muted-foreground">Processing…</p>
        ) : interimText ? (
          <p className="text-sm text-muted-foreground italic truncate max-w-lg">
            &ldquo;{interimText}&rdquo;
          </p>
        ) : lastSpeaker === "assistant" ? (
          <p className="text-sm text-muted-foreground">{assistantName} is speaking…</p>
        ) : (
          <p className="text-sm text-muted-foreground">Listening…</p>
        )}
      </div>

      <TranscriptViewer events={transcript} />
    </div>
  );
}
