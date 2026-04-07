import Link from "next/link";
import { db } from "@/lib/db";
import { assistants } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/helpers";
import { Button } from "@/components/ui/button";
import { AssistantTable } from "@/components/assistants/assistant-table";

export default async function AssistantsPage() {
  const user = await requireAuth();
  const rows = user.role === "viewer"
    ? await db.select().from(assistants).where(eq(assistants.status, "published")).orderBy(desc(assistants.updatedAt))
    : await db.select().from(assistants).orderBy(desc(assistants.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistants</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} assistant{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        {user.role === "admin" && (
          <Button render={<Link href="/assistants/new" />}>New assistant</Button>
        )}
      </div>

      <AssistantTable
        assistants={rows.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          language: r.language,
          voice: r.voice,
          version: r.version,
          updatedAt: r.updatedAt,
        }))}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
