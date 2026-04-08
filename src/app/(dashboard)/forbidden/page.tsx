import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldOff className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Access Denied</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          You don&apos;t have permission to view this page. Admin access is required.
        </p>
      </div>
      <Link href="/assistants">
        <Button variant="outline" size="sm">Go to Assistants</Button>
      </Link>
    </div>
  );
}
