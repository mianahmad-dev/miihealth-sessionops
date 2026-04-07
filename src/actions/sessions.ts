"use server";

import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/helpers";
import { eq } from "drizzle-orm";

export async function updateSessionStatus(
  sessionId: string,
  status: "active" | "ending"
): Promise<void> {
  await requireAuth();
  await db.update(sessions).set({ status }).where(eq(sessions.id, sessionId));
}
