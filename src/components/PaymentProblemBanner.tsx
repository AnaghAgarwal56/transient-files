import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PaymentProblem } from "@/hooks/usePayment";

interface Props {
  problem: PaymentProblem;
  retrying?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
  /** Optional secondary action, e.g. "Pay from wallet instead". */
  secondary?: { label: string; onClick: () => void; disabled?: boolean };
}

/** Explains a cancelled or failed payment and offers a clear way to retry. */
export function PaymentProblemBanner({
  problem,
  retrying = false,
  onRetry,
  onDismiss,
  secondary,
}: Props) {
  const cancelled = problem.kind === "cancelled";
  return (
    <div
      role="alert"
      className={`panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
        cancelled ? "ring-1 ring-border" : "ring-1 ring-destructive/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`mt-0.5 size-5 shrink-0 ${cancelled ? "text-muted-foreground" : "text-destructive"}`}
        />
        <div>
          <p className="text-sm font-medium">
            {cancelled ? "Payment cancelled" : "Payment did not go through"}
          </p>
          <p className="text-sm text-muted-foreground">{problem.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nothing was added to your account and no transfer capacity was reserved.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {secondary && (
          <Button size="sm" variant="secondary" disabled={secondary.disabled} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        <Button size="sm" disabled={retrying} onClick={onRetry}>
          {retrying ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 size-4" />
          )}
          Try again
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="size-8"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
