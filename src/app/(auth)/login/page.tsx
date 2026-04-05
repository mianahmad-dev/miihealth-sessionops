import { getCurrentUser } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/assistants");

  return <LoginForm />;
}
