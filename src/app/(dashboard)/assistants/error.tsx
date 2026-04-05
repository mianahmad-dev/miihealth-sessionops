"use client";

export default function AssistantsError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <p className="text-sm text-destructive font-medium">Failed to load assistants</p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="text-sm text-primary hover:underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}
