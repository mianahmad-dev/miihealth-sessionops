"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EndSessionButton } from "@/components/sessions/end-session-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SESSION_STATUSES } from "@/lib/constants";

export interface SessionRow {
  id: string;
  assistantId: string;
  assistantName: string;
  assistantVersion: number;
  status: (typeof SESSION_STATUSES)[number];
  startedAt: number | null;
  durationSec: number | null;
  turnCount: number | null;
  operatorName?: string;
}

const STATUS_BADGE: Record<
  (typeof SESSION_STATUSES)[number],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  initializing: { label: "Initializing", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  ending: { label: "Ending", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
  failed: { label: "Failed", variant: "destructive" },
  needs_review: { label: "Needs Review", variant: "destructive" },
};

function formatDate(unix: number | null): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString();
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

interface SessionTableProps {
  sessions: SessionRow[];
  hideAssistantCol?: boolean;
}

export function SessionTable({ sessions, hideAssistantCol = false }: SessionTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const showOperator = sessions.some((s) => s.operatorName !== undefined);

  const filtered = sessions.filter((s) => {
    const matchesSearch = s.assistantName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        {!hideAssistantCol && (
          <Input
            placeholder="Search by assistant name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        )}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SESSION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_BADGE[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-sm text-muted-foreground">
            {sessions.length === 0 ? "No sessions recorded yet." : "No sessions match your filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {!hideAssistantCol && <TableHead>Assistant</TableHead>}
                {showOperator && <TableHead>Operator</TableHead>}
                <TableHead>Version</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Turns</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((session) => {
                const badge = STATUS_BADGE[session.status];
                return (
                  <TableRow key={session.id}>
                    <TableCell className="text-sm">{formatDate(session.startedAt)}</TableCell>
                    {!hideAssistantCol && (
                      <TableCell className="font-medium">{session.assistantName}</TableCell>
                    )}
                    {showOperator && (
                      <TableCell className="text-sm text-muted-foreground">{session.operatorName ?? "—"}</TableCell>
                    )}
                    <TableCell className="text-sm text-muted-foreground">
                      v{session.assistantVersion}
                    </TableCell>
                    <TableCell className="text-sm">{formatDuration(session.durationSec)}</TableCell>
                    <TableCell className="text-sm">{session.turnCount ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/sessions/${session.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </Link>
                        {(session.status === "active" || session.status === "initializing") && (
                          <EndSessionButton sessionId={session.id} />
                        )}
                      </div>
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
