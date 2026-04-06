import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users, assistants } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth/helpers";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_BADGE: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  create: { label: "Create", variant: "default" },
  update: { label: "Update", variant: "secondary" },
  publish: { label: "Publish", variant: "default" },
  archive: { label: "Archive", variant: "outline" },
  duplicate: { label: "Duplicate", variant: "secondary" },
};

function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleString();
}

export default async function AuditPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      changes: auditLogs.changes,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      userEmail: users.email,
      assistantName: assistants.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .leftJoin(assistants, eq(auditLogs.entityId, assistants.id))
    .orderBy(desc(auditLogs.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          All administrative actions — {rows.length} record{rows.length !== 1 ? "s" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-sm text-muted-foreground">No audit records yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const badge = ACTION_BADGE[row.action] ?? { label: row.action, variant: "secondary" as const };
                const entityName = row.entityType === "assistant"
                  ? (row.assistantName ?? row.entityId)
                  : row.entityId;
                const changes = row.changes ? (() => {
                  try {
                    return JSON.stringify(JSON.parse(row.changes), null, 0);
                  } catch {
                    return row.changes;
                  }
                })() : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{row.userName ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{row.entityType}</TableCell>
                    <TableCell className="text-sm font-medium">{entityName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {changes ?? <span className="italic">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
