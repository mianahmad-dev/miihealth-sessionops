"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TranscriptRow {
  id: string;
  speaker: "user" | "assistant" | "system";
  content: string;
  timestampMs: number;
  sequenceNum: number;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function TranscriptEntry({ event }: { event: TranscriptRow }) {
  if (event.speaker === "system") {
    return (
      <div className="flex justify-center py-1">
        <span className="text-xs text-muted-foreground italic">{event.content}</span>
      </div>
    );
  }

  const isUser = event.speaker === "user";

  return (
    <div className={cn("flex gap-2 items-start", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
          isUser ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
        )}
      >
        {isUser ? "P" : "A"}
      </div>
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2 space-y-1",
          isUser ? "bg-blue-50 text-blue-900" : "bg-green-50 text-green-900"
        )}
      >
        <p className="text-sm leading-relaxed">{event.content}</p>
        <p className="text-xs opacity-50">{formatMs(event.timestampMs)}</p>
      </div>
    </div>
  );
}

export function TranscriptViewer({ events }: { events: TranscriptRow[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center rounded-lg border bg-muted/20 p-8 min-h-[300px]">
        <p className="text-sm text-muted-foreground">Waiting for conversation to begin...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto rounded-lg border bg-background p-4 space-y-3 min-h-[300px] max-h-[calc(100vh-280px)]">
      {events.map((event) => (
        <TranscriptEntry key={event.id} event={event} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
