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
  // micReady = recognition is running and accepting input (not suppressed by TTS)
  // ttsPlaying = an utterance is currently being spoken
  const [micReady, setMicReady] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // TTS echo suppression — three layered guards:
  //   1. ttsQueueRef > 0     → utterance(s) currently playing or queued
  //   2. Date.now() < micOpenAtRef  → cooldown window after last utterance ends
  //   3. speechSynthesis.speaking   → browser ground-truth (handles edge cases)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const spokenIdsRef = useRef<Set<string>>(new Set());
  const ttsQueueRef = useRef(0);       // # utterances in flight (not a boolean — handles queuing)
  const micOpenAtRef = useRef<number>(0); // earliest ms at which results should be trusted

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

        // Abort recognition immediately — this hard-clears Chrome's STT audio
        // pipeline so no echo audio can ever produce a result. Without abort(),
        // Chrome's 1–3 s STT latency means echo captured during TTS arrives as
        // a "final" result long after the utterance ends, past any cooldown window.
        ttsQueueRef.current++;
        setTtsPlaying(true);
        setMicReady(false);
        setInterimText("");
        recognitionRef.current?.abort();

        // onTTSDone fires on both clean end AND error/cancel.
        // Chrome only fires onend for the currently-playing utterance on cancel() —
        // queued utterances receive onerror("interrupted") instead of onend.
        // Handling both guarantees the counter always drains to 0.
        const onTTSDone = () => {
          ttsQueueRef.current = Math.max(0, ttsQueueRef.current - 1);
          if (ttsQueueRef.current > 0) return; // more utterances still in flight
          setTtsPlaying(false);
          // Short cooldown for speaker acoustic decay. Can be short because abort()
          // already cleared the pipeline — we're not waiting for buffered echo.
          const delay = 300;
          micOpenAtRef.current = Date.now() + delay;
          setTimeout(() => {
            if (ttsQueueRef.current > 0) return; // another utterance queued in the gap
            try {
              recognitionRef.current?.start();
              setMicReady(true);
            } catch { /* already running */ }
          }, delay);
        };

        utterance.onend = onTTSDone;
        utterance.onerror = onTTSDone;

        window.speechSynthesis.speak(utterance);
      }
    });

    es.addEventListener("end", (e) => {
      const data = JSON.parse(e.data) as { status: string; sessionId: string };
      es.close();
      ttsQueueRef.current = 0;
      setTtsPlaying(false);
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
      ttsQueueRef.current = 0;
      setTtsPlaying(false);
      window.speechSynthesis?.cancel();
    };
  }, [sessionId, router, assistantLanguage]);

  // ─── Web Speech API (SpeechRecognition) ────────────────────────────────────
  // Chrome stops recognition after ~60 s of silence — onend restarts it unless
  // the session is torn down. We never abort during TTS; recognition runs
  // continuously and onresult simply discards results while suppressed.
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
      // Three-layer guard — discard results that are or could be TTS echo:
      //   1. An utterance is actively queued/playing
      //   2. We're within the post-TTS acoustic cooldown window
      //   3. The browser reports speech synthesis is still active (catches edge cases
      //      where onend fires slightly early on some browser versions)
      if (
        ttsQueueRef.current > 0 ||
        Date.now() < micOpenAtRef.current ||
        window.speechSynthesis.speaking
      ) {
        setInterimText("");
        return;
      }

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
      setMicReady(false);
      // Fires on: (a) Chrome's ~60 s silence timeout, (b) our TTS abort() call.
      // For case (b) we must not restart — onTTSDone handles the restart after
      // TTS finishes. For case (a) we restart only once TTS is done and the
      // cooldown has cleared, so no echo audio can enter the fresh session.
      if (!stopped && ttsQueueRef.current === 0 && Date.now() >= micOpenAtRef.current) {
        try {
          recognition.start();
          setMicReady(true);
        } catch { /* already starting */ }
      }
    };

    try {
      recognition.start();
      setMicReady(true);
    } catch {
      // Already started
    }

    return () => {
      stopped = true;
      recognition.abort();
      recognitionRef.current = null;
      setInterimText("");
      setMicReady(false);
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
        // Gate on mic permission before creating a session — no session should
        // exist in the DB if the user hasn't allowed microphone access.
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          if (controller.signal.aborted) return;
          setUiStatus("mic_denied");
          return;
        }
        // Release the stream immediately — SpeechRecognition manages its own handle.
        stream.getTracks().forEach((t) => t.stop());

        if (controller.signal.aborted) return;

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
      ttsQueueRef.current = 0;
      window.speechSynthesis?.cancel();
      recognitionRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEndSession() {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setUiStatus("ending");
    ttsQueueRef.current = 0;
    setTtsPlaying(false);
    setMicReady(false);
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

      <div className="rounded-md border bg-muted/40 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {isSending ? (
            <p className="text-sm text-muted-foreground">Processing…</p>
          ) : interimText ? (
            <p className="text-sm text-muted-foreground italic truncate">
              &ldquo;{interimText}&rdquo;
            </p>
          ) : ttsPlaying ? (
            <p className="text-sm text-muted-foreground">{assistantName} is speaking…</p>
          ) : micReady ? (
            <>
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
              </span>
              <span className="text-sm font-medium text-primary">Your turn — go ahead and speak</span>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">…</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 shrink-0 hidden sm:block">
          Wait for the blue signal before speaking
        </p>
      </div>

      <TranscriptViewer events={transcript} />
    </div>
  );
}
