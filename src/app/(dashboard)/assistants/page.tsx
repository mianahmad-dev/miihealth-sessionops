import { requireAuth } from "@/lib/auth/helpers";
import { LogoutButton } from "@/components/logout-button";

export default async function AssistantsPage() {
  const user = await requireAuth();

  return (
    <main className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Assistants</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {user.name} ({user.role})
          </span>
          <LogoutButton />
        </div>
      </div>
      <p className="text-muted-foreground">Phase 2 will build this out.</p>
    </main>
  );
}
