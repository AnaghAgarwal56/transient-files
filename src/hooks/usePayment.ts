import { useCallback, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  closePaymentOrderFn,
  createPaymentOrderFn,
  verifyPaymentFn,
} from "@/lib/billing.functions";
import { openCheckout } from "@/lib/razorpay";

type VerifyOk = Extract<Awaited<ReturnType<typeof verifyPaymentFn>>, { ok: true }>["data"];

export interface PayRequest {
  purpose: "topup" | "pack";
  planId?: string;
  amountPaise?: number;
}

export type PayResult =
  | { status: "paid"; data: VerifyOk }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/** A payment attempt that ended without money changing hands. */
export interface PaymentProblem {
  kind: "cancelled" | "failed";
  message: string;
  request: PayRequest;
}

/**
 * Runs the full Razorpay flow: order -> checkout -> server-side verification.
 * Cancellations and failures resolve normally (never throw), get recorded
 * server-side so no order is left dangling, and are exposed as a retryable
 * `problem` for the UI.
 */
export function usePayment() {
  const orderFn = useServerFn(createPaymentOrderFn);
  const verifyFn = useServerFn(verifyPaymentFn);
  const closeFn = useServerFn(closePaymentOrderFn);
  const [problem, setProblem] = useState<PaymentProblem | null>(null);

  const clearProblem = useCallback(() => setProblem(null), []);

  const pay = useCallback(
    async (request: PayRequest): Promise<PayResult> => {
      setProblem(null);
      const fail = (kind: "cancelled" | "failed", message: string): PayResult => {
        setProblem({ kind, message, request });
        return kind === "cancelled" ? { status: "cancelled" } : { status: "failed", reason: message };
      };

      const order = await orderFn({
        data: {
          purpose: request.purpose,
          ...(request.planId ? { planId: request.planId } : {}),
          ...(request.amountPaise != null ? { amountPaise: request.amountPaise } : {}),
        },
      });
      if (!order.ok) return fail("failed", order.message);

      const outcome = await openCheckout({
        keyId: order.data.keyId,
        orderId: order.data.orderId,
        amountPaise: order.data.amountPaise,
        description: order.data.description,
      });

      if (outcome.status !== "paid") {
        // Close the order out so nothing stays pending on your account.
        void closeFn({
          data: {
            orderId: order.data.orderId,
            outcome: outcome.status,
            ...(outcome.status === "failed" ? { reason: outcome.reason } : {}),
          },
        }).catch(() => undefined);
        return outcome.status === "cancelled"
          ? fail("cancelled", "Payment cancelled — you were not charged and nothing was reserved.")
          : fail("failed", outcome.reason);
      }

      const verified = await verifyFn({
        data: {
          orderId: outcome.orderId,
          paymentId: outcome.paymentId,
          signature: outcome.signature,
        },
      });
      if (!verified.ok) {
        return fail(
          "failed",
          `${verified.message} If money left your account it will be refunded automatically.`,
        );
      }
      return { status: "paid", data: verified.data };
    },
    [orderFn, verifyFn, closeFn],
  );

  return { pay, problem, clearProblem };
}
