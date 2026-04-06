"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TranscriptViewer, type TranscriptRow } from "@/components/sessions/transcript-viewer";
import { createSession, updateSessionStatus } from "@/actions/sessions";

type UIStatus =
  | "mic_check"
  | "mic_denied"
  | "initializing"
  | "active"
  | "ending"
  | "completed"
  | "needs_review"
  | "failed";

interface Props {
  assistantId: string;
  assistantName: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LiveSession({ assistantId, assistantName }: Props) {
  const router = useRouter();
  const [uiStatus, setUiStatus] = useState<UIStatus>("mic_check");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastSpeaker, setLastSpeaker] = useState<"user" | "assistant" | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const sessionIdRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

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
      if (event.speaker !== "system") {
        setLastSpeaker(event.speaker);
      }
    });

    es.addEventListener("end", (e) => {
      const data = JSON.parse(e.data) as { status: string; sessionId: string };
      es.close();
      if (data.status === "completed" || data.status === "needs_review") {
        router.push(`/sessions/${sessionId}`);
      } else {
        setUiStatus("failed");
        setError("Session ended with an error");
      }
    });

    es.onerror = () => es.close();

    return () => es.close();
  }, [sessionId, router]);

  // MediaRecorder — starts when active
  useEffect(() => {
    if (uiStatus !== "active" || !streamRef.current || !sessionIdRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : undefined;

    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = async (e) => {
      const sid = sessionIdRef.current;
      if (e.data.size > 0 && sid) {
        const formData = new FormData();
        formData.append("audio", e.data, "audio.webm");
        formData.append("sessionId", sid);
        try {
          await fetch("/api/voice/process", { method: "POST", body: formData });
        } catch {
          // ignore chunk send errors; transcript still visible via SSE
        }
      }
    };

    recorder.start(3000); // emit chunk every 3 s
    recorderRef.current = recorder;

    return () => {
      if (recorder.state !== "inactive") recorder.stop();
    };
  }, [uiStatus]);

  // Session startup — runs once on mount
  useEffect(() => {
    async function start() {
      // 1. Request mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setUiStatus("mic_denied");
        } else {
          setError(err instanceof Error ? err.message : "Microphone unavailable");
          setUiStatus("failed");
        }
        return;
      }

      // 2. Create session
      setUiStatus("initializing");
      try {
        const { sessionId: sid } = await createSession(assistantId);
        setSessionId(sid);
        sessionIdRef.current = sid;

        // 3. Transition to active
        await updateSessionStatus(sid, "active");
        startTimeRef.current = Date.now();
        setUiStatus("active");
      } catch (err) {
        stream.getTracks().forEach((t) => t.stop());
        setError(err instanceof Error ? err.message : "Failed to start session");
        setUiStatus("failed");
      }
    }

    start();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      eventSourceRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEndSession() {
    const sid = sessionIdRef.current;
    if (!sid) return;

    setUiStatus("ending");

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
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

  // --- Render states ---

  if (uiStatus === "mic_denied") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Microphone Access Required</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Allow microphone access in your browser, then click Retry. Without it the session
            cannot capture audio.
          </p>
        </div>
        <Button
          onClick={() => {
            setUiStatus("mic_check");
            // Re-trigger startup by forcing a page refresh — simplest retry path
            window.location.reload();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (uiStatus === "mic_check" || uiStatus === "initializing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          {uiStatus === "mic_check" ? "Requesting microphone access…" : "Connecting…"}
        </p>
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
      {/* Header */}
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

      {/* Speaker indicator */}
      <div className="h-5">
        {lastSpeaker && (
          <p className="text-sm text-muted-foreground">
            {lastSpeaker === "assistant"
              ? `${assistantName} is speaking…`
              : "Patient is speaking…"}
          </p>
        )}
      </div>

      {/* Transcript */}
      <TranscriptViewer events={transcript} />
    </div>
  );
}
