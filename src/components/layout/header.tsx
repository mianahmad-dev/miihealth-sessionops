import { requireAuth } from "@/lib/auth/helpers";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const user = await requireAuth();

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{user.name}</span>
        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
          {user.role}
        </Badge>
        <LogoutButton />
      </div>
    </header>
  );
}
