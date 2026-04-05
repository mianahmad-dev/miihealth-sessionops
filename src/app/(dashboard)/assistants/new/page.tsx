import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/helpers";
import { AssistantForm } from "@/components/assistants/assistant-form";

export default async function NewAssistantPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/assistants"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to assistants
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New assistant</h1>
      </div>
      <AssistantForm />
    </div>
  );
}
