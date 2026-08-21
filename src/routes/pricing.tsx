import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Loader2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { PaymentProblemBanner } from "@/components/PaymentProblemBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePayment } from "@/hooks/usePayment";
import {
  FREE_PLAN,
  TRANSFER_PACKS,
  WALLET_TOPUPS,
  formatInr,
  findPack,
  type TransferPack,
} from "@/lib/pricing";
import { formatBytes } from "@/lib/transfer-types";
import { buyPackWithWalletFn, getBillingOverviewFn } from "@/lib/billing.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Pay only when you transfer | DataTransfer" },
      {
        name: "description",
        content:
          "Free 200 MB transfers, or pay per transfer from ₹9 for 500 MB up to ₹499 for 100 GB. Optional prepaid wallet. No monthly subscription.",
      },
      { property: "og:title", content: "Pricing — Pay only when you transfer" },
      {
        property: "og:description",
        content: "One-time transfer packs from ₹9. Free tier included. No subscription, ever.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { signedIn, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getBillingOverviewFn);
  const walletBuyFn = useServerFn(buyPackWithWalletFn);
  const { pay, problem, clearProblem } = usePayment();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: () => overviewFn({ data: undefined as never }),
    enabled: signedIn,
  });
  const balancePaise = billing?.ok ? billing.data.balancePaise : 0;

  const payDirect = useMutation({
    mutationFn: (pack: TransferPack) => pay({ purpose: "pack", planId: pack.id }),
    onSettled: () => setPendingId(null),
    onSuccess: (result) => {
      if (result.status === "cancelled") {
        toast.info("Payment cancelled. You were not charged.");
        return;
      }
      if (result.status === "failed") {
        toast.error(result.reason);
        return;
      }
      toast.success("Transfer pack added to your account.");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      void navigate({ to: "/wallet" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Payment could not be completed.");
    },
  });

  const payWallet = useMutation({
    mutationFn: async (pack: TransferPack) => {
      const result = await walletBuyFn({
        data: { planId: pack.id, idempotencyKey: crypto.randomUUID() },
      });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSettled: () => setPendingId(null),
    onSuccess: () => {
      clearProblem();
      toast.success("Paid from wallet. Your transfer pack is ready.");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      void navigate({ to: "/wallet" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Wallet payment failed.");
    },
  });

  function buy(pack: TransferPack, mode: "direct" | "wallet") {
    if (!signedIn) {
      toast.info("Sign in first so we can attach the purchase to your account.");
      void navigate({ to: "/auth" });
      return;
    }
    setPendingId(`${pack.id}-${mode}`);
    if (mode === "direct") payDirect.mutate(pack);
    else payWallet.mutate(pack);
  }

  const failedPack = problem?.request.planId ? findPack(problem.request.planId) : null;
  const retrying = payDirect.isPending || payWallet.isPending;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <header className="mx-auto max-w-2xl text-center">
        <StatusBadge tone="active">No monthly subscription</StatusBadge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">
          Pay only when you transfer
        </h1>
        <p className="mt-3 text-muted-foreground">
          Start free. When you need more room, buy a one-time transfer pack — directly or from your
          prepaid DataTransfer Wallet.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/create">
            Start a Transfer <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </header>

      {/* FREE */}
      <section className="panel mt-14 p-6 sm:p-8" aria-labelledby="free-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="free-heading" className="text-xl font-semibold">
              Free plan
            </h2>
            <p className="text-sm text-muted-foreground">Always available, no account needed.</p>
          </div>
          <p className="code-chip text-3xl font-semibold text-primary">₹0</p>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            `Up to ${formatBytes(FREE_PLAN.maxTransferBytes)} per transfer`,
            `Room lifetime ${FREE_PLAN.lifetimeMinutes / 60} hours`,
            `${FREE_PLAN.maxParticipants} participants`,
            "PC ↔ PC, PC ↔ Phone, Phone ↔ Phone",
            "QR-code joining",
            "Temporary rooms, auto-deleted",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-success" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* PAY PER TRANSFER */}
      <section className="mt-14" aria-labelledby="packs-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="packs-heading" className="text-2xl font-semibold">
              Pay-per-transfer
            </h2>
            <p className="text-sm text-muted-foreground">
              One-time payment per pack. Use it whenever you like — it never expires until used.
            </p>
          </div>
          {signedIn && !loading && (
            <p className="text-sm text-muted-foreground">
              Wallet balance:{" "}
              <span className="code-chip font-semibold text-foreground">
                {formatInr(balancePaise)}
              </span>
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRANSFER_PACKS.map((pack) => {
            const affordable = balancePaise >= pack.pricePaise;
            return (
              <article
                key={pack.id}
                className={`panel flex flex-col p-5 ${pack.popular ? "ring-1 ring-primary" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{pack.label}</h3>
                  {pack.popular && <StatusBadge tone="downloading">Popular</StatusBadge>}
                </div>
                <p className="code-chip mt-2 text-2xl font-semibold text-primary">
                  {formatInr(pack.pricePaise)}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-muted-foreground">
                  <li>{formatBytes(pack.bytes)} transfer capacity</li>
                  <li>Up to {pack.maxParticipants} participants</li>
                  <li>
                    Room up to{" "}
                    {pack.maxDurationMinutes >= 1440
                      ? `${pack.maxDurationMinutes / 1440} day${pack.maxDurationMinutes > 1440 ? "s" : ""}`
                      : `${pack.maxDurationMinutes / 60} hours`}
                  </li>
                </ul>
                <div className="mt-5 space-y-2">
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={pendingId !== null}
                    onClick={() => buy(pack, "direct")}
                  >
                    {pendingId === `${pack.id}-direct` ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Pay Directly
                  </Button>
                  <Button
                    className="w-full"
                    size="sm"
                    variant="secondary"
                    disabled={pendingId !== null || (signedIn && !affordable)}
                    onClick={() => buy(pack, "wallet")}
                  >
                    {pendingId === `${pack.id}-wallet` ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Wallet className="mr-2 size-4" />
                    )}
                    {signedIn && !affordable ? "Low balance" : "Pay From Wallet"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* WALLET */}
      <section className="panel mt-14 p-6 sm:p-8" aria-labelledby="wallet-heading">
        <h2 id="wallet-heading" className="text-2xl font-semibold">
          DataTransfer Wallet
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Optional prepaid balance for frequent transfers — top up once, then buy packs in a single
          tap. Every payment is verified on our servers before your balance changes.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {WALLET_TOPUPS.map((amount) => (
            <span key={amount} className="code-chip rounded-lg border border-border px-3 py-1.5 text-sm">
              {formatInr(amount)}
            </span>
          ))}
          <span className="code-chip rounded-lg border border-border px-3 py-1.5 text-sm">
            Custom ₹100–₹1,000
          </span>
        </div>
        <Button asChild className="mt-6" variant={signedIn ? "default" : "secondary"}>
          <Link to={signedIn ? "/wallet" : "/auth"}>
            {signedIn ? "Open your wallet" : "Sign in to use the wallet"}
          </Link>
        </Button>
      </section>
    </main>
  );
}
