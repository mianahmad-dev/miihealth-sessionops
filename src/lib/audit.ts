import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { v4 as uuidv4 } from "uuid";

type AuditAction = "create" | "update" | "publish" | "archive" | "duplicate";
type EntityType = "assistant" | "session";

export async function auditLog(
  userId: string,
  action: AuditAction,
  entityType: EntityType,
  entityId: string,
  changes?: Record<string, unknown>
) {
  await db.insert(auditLogs).values({
    id: uuidv4(),
    userId,
    action,
    entityType,
    entityId,
    changes: changes ? JSON.stringify(changes) : null,
    createdAt: Math.floor(Date.now() / 1000),
  });
}
