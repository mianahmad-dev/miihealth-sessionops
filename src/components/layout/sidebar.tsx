"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, History, ClipboardList, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const allNavItems = [
  { href: "/assistants", label: "Assistants", icon: Bot, adminOnly: false },
  { href: "/sessions", label: "Sessions", icon: History, adminOnly: false },
  { href: "/audit", label: "Audit Log", icon: ClipboardList, adminOnly: true },
  { href: "/evaluation", label: "Evaluation", icon: FlaskConical, adminOnly: true },
];

interface SidebarProps {
  role: "admin" | "viewer";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const navItems = allNavItems.filter((item) => !item.adminOnly || role === "admin");

  return (
    <aside className="w-56 border-r bg-muted/40 flex flex-col min-h-screen shrink-0">
      <div className="h-14 flex items-center px-4 border-b">
        <span className="font-semibold text-sm tracking-tight">SessionOps Studio</span>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith(href)
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
