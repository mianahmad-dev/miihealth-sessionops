"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { APPROVED_TOOLS, LANGUAGES, VOICES } from "@/lib/constants";
import { createAssistant, updateAssistant } from "@/actions/assistants";

type AssistantData = {
  id: string;
  name: string;
  purpose: string;
  language: string;
  voice: string;
  tools: string | null;
};

type Props = {
  initialData?: AssistantData;
};

export function AssistantForm({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const parsedTools: string[] = initialData?.tools
    ? (JSON.parse(initialData.tools) as string[])
    : [];

  const [name, setName] = useState(initialData?.name ?? "");
  const [purpose, setPurpose] = useState(initialData?.purpose ?? "");
  const [language, setLanguage] = useState(initialData?.language ?? "en");
  const [voice, setVoice] = useState(initialData?.voice ?? "default");
  const [selectedTools, setSelectedTools] = useState<string[]>(parsedTools);

  function toggleTool(toolId: string) {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("purpose", purpose);
    formData.set("language", language);
    formData.set("voice", voice);
    selectedTools.forEach((t) => formData.append("tools", t));

    startTransition(async () => {
      const result = initialData
        ? await updateAssistant(initialData.id, formData)
        : await createAssistant(formData);

      if (result?.error) {
        setError(result.error);
      }
      // redirect happens inside the action on success
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. General Intake Assistant"
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="purpose" className="text-sm font-medium">
          Purpose
        </label>
        <Textarea
          id="purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Describe the assistant's role and instructions..."
          rows={5}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Language</label>
          <Select value={language} onValueChange={(v) => setLanguage(v ?? "en")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Voice</label>
          <Select value={voice} onValueChange={(v) => setVoice(v ?? "default")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tools</label>
        <div className="space-y-2">
          {APPROVED_TOOLS.map((tool) => (
            <label
              key={tool.id}
              className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedTools.includes(tool.id)}
                onChange={() => toggleTool(tool.id)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <div>
                <div className="text-sm font-medium">{tool.name}</div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : initialData ? "Save changes" : "Create assistant"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/assistants")}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
