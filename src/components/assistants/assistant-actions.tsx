"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishAssistant, archiveAssistant, duplicateAssistant } from "@/actions/assistants";

type Props = {
  id: string;
  status: string;
};

export function AssistantActions({ id, status }: Props) {
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status === "draft" && (
        <Button
          size="sm"
          onClick={() => run(() => publishAssistant(id))}
          disabled={isPending}
        >
          Publish
        </Button>
      )}
      {status === "published" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => archiveAssistant(id))}
          disabled={isPending}
        >
          Archive
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => run(() => duplicateAssistant(id))}
        disabled={isPending}
      >
        Duplicate
      </Button>
    </div>
  );
}
