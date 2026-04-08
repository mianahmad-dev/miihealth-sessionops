"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => signOut({ callbackUrl: `${window.location.origin}/login` })}
      className="text-muted-foreground hover:text-foreground"
    >
      Sign out
    </Button>
  );
}
