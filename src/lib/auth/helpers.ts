import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }
  return user;
}
