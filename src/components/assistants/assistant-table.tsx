"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { publishAssistant, archiveAssistant, duplicateAssistant } from "@/actions/assistants";

type Assistant = {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  language: string;
  voice: string;
  version: number;
  updatedAt: number;
};

type Props = {
  assistants: Assistant[];
  isAdmin: boolean;
};

export function AssistantTable({ assistants, isAdmin }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const filtered = assistants.filter((a) => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function runAction(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center rounded-md border border-dashed py-16 text-sm text-muted-foreground">
          {assistants.length === 0
            ? "No assistants yet. Create your first one."
            : "No assistants match your filters."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Voice</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Updated</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((assistant) => (
                <TableRow key={assistant.id} className={isPending ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link
                      href={`/assistants/${assistant.id}`}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {assistant.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={assistant.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{assistant.language}</TableCell>
                  <TableCell className="text-muted-foreground">{assistant.voice}</TableCell>
                  <TableCell className="text-muted-foreground">v{assistant.version}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(assistant.updatedAt * 1000).toLocaleDateString()}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => window.location.assign(`/assistants/${assistant.id}`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {assistant.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => runAction(() => publishAssistant(assistant.id))}
                            >
                              Publish
                            </DropdownMenuItem>
                          )}
                          {assistant.status === "published" && (
                            <DropdownMenuItem
                              onClick={() => runAction(() => archiveAssistant(assistant.id))}
                            >
                              Archive
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => runAction(() => duplicateAssistant(assistant.id))}
                          >
                            Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
