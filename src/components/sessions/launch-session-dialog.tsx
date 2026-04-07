"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface AssistantOption {
  id: string;
  name: string;
  language: string;
  voice: string;
}

interface Props {
  assistants: AssistantOption[];
}

const LANG_LABEL: Record<string, string> = {
  en: "English",
  de: "German",
  es: "Spanish",
  fr: "French",
};

export function LaunchSessionDialog({ assistants }: Props) {
  const router = useRouter();

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>Launch Session</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Launch a Session</DialogTitle>
        </DialogHeader>

        {assistants.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No published assistants available. Publish an assistant first.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assistants.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => router.push(`/sessions/live/${a.id}`)}
                  className="w-full text-left rounded-lg border px-4 py-3 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="font-medium text-sm">{a.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {LANG_LABEL[a.language] ?? a.language} · {a.voice}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
