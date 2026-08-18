import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — DataTransfer Wallet" },
      {
        name: "description",
        content:
          "Sign in to buy pay-per-transfer packs and manage your DataTransfer Wallet. Transfers themselves never need an account.",
      },
      { property: "og:title", content: "Sign in — DataTransfer Wallet" },
      {
        property: "og:description",
        content: "An account is only needed for payments and your prepaid wallet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signedIn, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && signedIn) navigate({ to: "/wallet" });
  }, [loading, signedIn, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/wallet` },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error("Google sign-in is unavailable right now.");
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create an account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Only needed for payments and your wallet.
          </p>
        </div>
      </div>

      <form className="panel mt-8 space-y-4 p-6" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            minLength={8}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>

        <div className="relative py-2 text-center text-xs uppercase text-muted-foreground">
          <span className="bg-surface px-2">or</span>
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={google}>
          Continue with Google
        </Button>

        <p className="pt-2 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Just sending files?{" "}
        <Link to="/create" className="text-primary hover:underline">
          Start a free transfer
        </Link>{" "}
        — no account needed.
      </p>
    </main>
  );
}
