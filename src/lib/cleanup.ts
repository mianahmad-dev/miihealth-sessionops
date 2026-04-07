import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { and, eq, lt, inArray } from "drizzle-orm";

const STALE_THRESHOLD_SECONDS = 2 * 60 * 60; // 2 hours

/**
 * Finds sessions stuck in a non-terminal state for longer than the stale
 * threshold and marks them failed. Called lazily on session creation so no
 * background process is required.
 */
export async function cleanupStaleSessions(): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - STALE_THRESHOLD_SECONDS;

  const stale = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        inArray(sessions.status, ["initializing", "active", "ending"]),
        lt(sessions.createdAt, cutoff)
      )
    );

  if (stale.length === 0) return;

  const now = Math.floor(Date.now() / 1000);
  for (const { id } of stale) {
    await db
      .update(sessions)
      .set({
        status: "failed",
        errorReason: "Session timed out — cleaned up automatically",
        endedAt: now,
      })
      .where(eq(sessions.id, id));
  }
}
