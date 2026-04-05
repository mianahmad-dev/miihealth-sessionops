"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/assistants";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setPending(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push(callbackUrl);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between bg-primary px-12 py-10 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary-foreground/15 flex items-center justify-center">
            <MicIcon className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">SessionOps Studio</span>
        </div>

        <div className="space-y-5">
          <blockquote className="text-2xl font-light leading-snug text-primary-foreground/90">
            "Configure, launch, and review AI-powered voice intake assistants — all in one place."
          </blockquote>
          <div className="flex gap-3">
            <FeaturePill label="Voice Intake" />
            <FeaturePill label="Real-time Transcripts" />
            <FeaturePill label="Audit Logs" />
          </div>
        </div>

        <p className="text-xs text-primary-foreground/50">
          © {new Date().getFullYear()} MiiHealth — Internal use only
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <MicIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold tracking-tight text-foreground">SessionOps Studio</span>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@sessionops.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
                <AlertIcon className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={pending}>
              {pending ? (
                <span className="flex items-center gap-2">
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Internal access only. Contact your administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-2.5 py-1 text-xs font-medium text-primary-foreground/80">
      {label}
    </span>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
