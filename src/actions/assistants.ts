"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { assistants } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { auditLog } from "@/lib/audit";
import { createAssistantSchema } from "@/lib/validations";

type ActionResult = { error: string } | null;

export async function createAssistant(formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();

  const raw = {
    name: formData.get("name") as string,
    purpose: formData.get("purpose") as string,
    language: formData.get("language") as string,
    voice: formData.get("voice") as string,
    tools: formData.getAll("tools") as string[],
  };

  const parsed = createAssistantSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(assistants).values({
    id,
    name: parsed.data.name,
    purpose: parsed.data.purpose,
    language: parsed.data.language,
    voice: parsed.data.voice,
    tools: JSON.stringify(parsed.data.tools),
    status: "draft",
    version: 1,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });

  await auditLog(user.id, "create", "assistant", id, { name: parsed.data.name });

  redirect("/assistants");
}

export async function updateAssistant(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();

  const raw = {
    name: formData.get("name") as string,
    purpose: formData.get("purpose") as string,
    language: formData.get("language") as string,
    voice: formData.get("voice") as string,
    tools: formData.getAll("tools") as string[],
  };

  const parsed = createAssistantSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const current = await db.select().from(assistants).where(eq(assistants.id, id)).get();
  if (!current) return { error: "Assistant not found" };

  const now = Math.floor(Date.now() / 1000);

  await db
    .update(assistants)
    .set({
      name: parsed.data.name,
      purpose: parsed.data.purpose,
      language: parsed.data.language,
      voice: parsed.data.voice,
      tools: JSON.stringify(parsed.data.tools),
      version: current.version + 1,
      updatedAt: now,
    })
    .where(eq(assistants.id, id));

  await auditLog(user.id, "update", "assistant", id, { before: { name: current.name }, after: { name: parsed.data.name } });

  redirect("/assistants");
}

export async function publishAssistant(id: string): Promise<ActionResult> {
  const user = await requireAdmin();

  await db
    .update(assistants)
    .set({ status: "published", updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(assistants.id, id));

  await auditLog(user.id, "publish", "assistant", id);

  redirect("/assistants");
}

export async function archiveAssistant(id: string): Promise<ActionResult> {
  const user = await requireAdmin();

  await db
    .update(assistants)
    .set({ status: "archived", updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(assistants.id, id));

  await auditLog(user.id, "archive", "assistant", id);

  redirect("/assistants");
}

export async function duplicateAssistant(id: string): Promise<ActionResult> {
  const user = await requireAdmin();

  const original = await db.select().from(assistants).where(eq(assistants.id, id)).get();
  if (!original) return { error: "Assistant not found" };

  const newId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(assistants).values({
    id: newId,
    name: `${original.name} (Copy)`,
    purpose: original.purpose,
    language: original.language,
    voice: original.voice,
    tools: original.tools,
    status: "draft",
    version: 1,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  });

  await auditLog(user.id, "duplicate", "assistant", newId, { originalId: id });

  redirect("/assistants");
}
