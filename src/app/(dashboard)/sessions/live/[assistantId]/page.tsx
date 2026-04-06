import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { assistants } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { LiveSession } from "@/components/sessions/live-session";

type Props = {
  params: Promise<{ assistantId: string }>;
};

export default async function LiveSessionPage({ params }: Props) {
  const { assistantId } = await params;
  await requireAuth();

  const assistant = await db
    .select()
    .from(assistants)
    .where(eq(assistants.id, assistantId))
    .get();

  if (!assistant) notFound();

  if (assistant.status !== "published") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Assistant Not Published</h2>
          <p className="text-sm text-muted-foreground">
            &quot;{assistant.name}&quot; must be published before launching sessions.
          </p>
        </div>
        <Link href="/assistants" className="text-sm text-primary hover:underline">
          Back to Assistants
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <LiveSession assistantId={assistant.id} assistantName={assistant.name} />
    </div>
  );
}
