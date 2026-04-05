import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assistants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { AssistantForm } from "@/components/assistants/assistant-form";
import { StatusBadge } from "@/components/assistants/status-badge";
import { AssistantActions } from "@/components/assistants/assistant-actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAssistantPage({ params }: Props) {
  const { id } = await params;
  const user = await requireAuth();

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, id))
    .get();

  if (!assistant) notFound();

  const isAdmin = user.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/assistants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to assistants
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{assistant.name}</h1>
          <StatusBadge status={assistant.status} />
          <span className="text-sm text-muted-foreground">v{assistant.version}</span>
        </div>
      </div>

      {isAdmin && (
        <AssistantActions
          id={assistant.id}
          status={assistant.status}
        />
      )}

      {isAdmin ? (
        <AssistantForm initialData={assistant} />
      ) : (
        <ViewerAssistantDetail assistant={assistant} />
      )}
    </div>
  );
}

function ViewerAssistantDetail({
  assistant,
}: {
  assistant: {
    name: string;
    purpose: string;
    language: string;
    voice: string;
    tools: string | null;
    status: string;
    version: number;
  };
}) {
  const tools: string[] = assistant.tools ? (JSON.parse(assistant.tools) as string[]) : [];

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-md border p-4 space-y-3">
        <Field label="Purpose" value={assistant.purpose} />
        <Field label="Language" value={assistant.language} />
        <Field label="Voice" value={assistant.voice} />
        <div>
          <div className="text-xs text-muted-foreground mb-1">Tools</div>
          {tools.length === 0 ? (
            <span className="text-sm text-muted-foreground">None</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tools.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You have viewer access. Contact an admin to make changes.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
