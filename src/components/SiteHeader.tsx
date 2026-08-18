import { Link } from "@tanstack/react-router";
import { ShieldCheck, Wallet } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function SiteHeader() {
  const { signedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">DataTransfer</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/pricing">Pricing</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/join">Join</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={signedIn ? "/wallet" : "/auth"} aria-label="Wallet">
              <Wallet className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Wallet</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/create">Start transfer</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
