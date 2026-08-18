import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Loader2, Package, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import {
  WALLET_MAX_PAISE,
  WALLET_MIN_PAISE,
  WALLET_TOPUPS,
  formatInr,
  type BillingOverview,
} from "@/lib/pricing";
import { formatBytes } from "@/lib/transfer-types";
import {
  createPaymentOrderFn,
  getBillingOverviewFn,
  verifyPaymentFn,
} from "@/lib/billing.functions";
import { openCheckout } from "@/lib/razorpay";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & purchases — DataTransfer" },
      {
        name: "description",
        content:
          "Check your DataTransfer Wallet balance, top up from ₹100 to ₹1,000, review transactions and use purchased transfer packs.",
      },
      { property: "og:title", content: "Wallet & purchases — DataTransfer" },
      {
        property: "og:description",
        content: "Prepaid balance, transaction history and your unused transfer packs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getBillingOverviewFn);
  const orderFn = useServerFn(createPaymentOrderFn);
  const verifyFn = useServerFn(verifyPaymentFn);
  const [custom, setCustom] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["billing"],
    queryFn: () => overviewFn({ data: undefined as never }),
  });

  const topUp = useMutation({
    mutationFn: async (amountPaise: number) => {
      const order = await orderFn({ data: { purpose: "topup", amountPaise } });
      if (!order.ok) throw new Error(order.message);
      const result = await openCheckout({
        keyId: order.data.keyId,
        orderId: order.data.orderId,
        amountPaise: order.data.amountPaise,
        description: order.data.description,
      });
      if (!result) return null;
      const verified = await verifyFn({
        data: { orderId: result.orderId, paymentId: result.paymentId, signature: result.signature },
      });
      if (!verified.ok) throw new Error(verified.message);
      return verified.data;
    },
    onSuccess: (result) => {
      if (!result) return;
      toast.success("Wallet topped up.");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Payment could not be completed."),
  });

  const overview: BillingOverview | null = data?.ok ? data.data : null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Wallet className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Wallet &amp; purchases</h1>
          <p className="text-sm text-muted-foreground">
            Pay only when you transfer. No monthly subscription.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="panel mt-8 flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading your balance…
        </div>
      ) : !overview ? (
        <div className="panel mt-8 p-6 text-sm text-muted-foreground">
          {data && !data.ok ? data.message : "Could not load your wallet."}
        </div>
      ) : (
        <>
          <section className="panel mt-8 p-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
            <p className="code-chip mt-1 text-4xl font-semibold text-primary">
              {formatInr(overview.balancePaise)}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {WALLET_TOPUPS.map((amount) => (
                <Button
                  key={amount}
                  variant="secondary"
                  disabled={topUp.isPending}
                  onClick={() => topUp.mutate(amount)}
                >
                  Add {formatInr(amount)}
                </Button>
              ))}
            </div>

            <form
              className="mt-6 flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const paise = Math.round(Number(custom) * 100);
                if (!Number.isFinite(paise) || paise < WALLET_MIN_PAISE || paise > WALLET_MAX_PAISE) {
                  toast.error("Enter an amount between ₹100 and ₹1,000.");
                  return;
                }
                topUp.mutate(paise);
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="custom" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Custom amount (₹100–₹1,000)
                </Label>
                <Input
                  id="custom"
                  inputMode="numeric"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="250"
                  className="w-40"
                />
              </div>
              <Button type="submit" disabled={topUp.isPending}>
                {topUp.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Top up
              </Button>
            </form>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Your transfer packs</h2>
            {overview.credits.length === 0 ? (
              <p className="panel mt-3 p-6 text-sm text-muted-foreground">
                No packs yet.{" "}
                <Link to="/pricing" className="text-primary hover:underline">
                  Buy a pay-per-transfer pack
                </Link>{" "}
                for bigger files, longer rooms and more participants.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {overview.credits.map((credit) => (
                  <li key={credit.id} className="panel flex flex-wrap items-center gap-4 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-primary">
                      <Package className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{credit.label} transfer</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(credit.bytesUsed)} of {formatBytes(credit.bytesTotal)} used ·{" "}
                        up to {credit.maxParticipants} participants
                      </p>
                    </div>
                    <StatusBadge
                      tone={
                        credit.status === "unused"
                          ? "active"
                          : credit.status === "active"
                            ? "uploading"
                            : "expired"
                      }
                    >
                      {credit.status === "unused"
                        ? "Ready"
                        : credit.status === "active"
                          ? "In use"
                          : "Used"}
                    </StatusBadge>
                    {credit.status === "unused" && (
                      <Button asChild size="sm">
                        <Link to="/create" search={{ credit: credit.id }}>
                          Start transfer <ArrowUpRight className="ml-1 size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Transaction history</h2>
            {overview.transactions.length === 0 ? (
              <p className="panel mt-3 p-6 text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              <ul className="panel mt-3 divide-y divide-border">
                {overview.transactions.map((txn) => (
                  <li key={txn.id} className="flex items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{txn.description || txn.kind}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <p
                      className={`code-chip text-sm font-semibold ${
                        txn.amountPaise < 0 ? "text-muted-foreground" : "text-success"
                      }`}
                    >
                      {txn.amountPaise < 0 ? "−" : "+"}
                      {formatInr(Math.abs(txn.amountPaise))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
