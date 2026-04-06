"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface EndSessionButtonProps {
  sessionId: string;
}

export function EndSessionButton({ sessionId }: EndSessionButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleEnd() {
    setLoading(true);
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      className="h-6 px-2 text-xs"
      disabled={loading}
      onClick={handleEnd}
    >
      {loading ? "Ending..." : "End"}
    </Button>
  );
}
