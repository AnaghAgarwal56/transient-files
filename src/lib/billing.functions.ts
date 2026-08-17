import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { BillingOverview } from "./pricing";

type Fail = { ok: false; code: string; message: string };
type Ok<T> = { ok: true; data: T };
export type BillingResult<T> = Ok<T> | Fail;

async function guard<T>(run: () => Promise<T>): Promise<BillingResult<T>> {
  const { BillingError } = await import("./billing.server");
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    if (error instanceof BillingError) {
      return { ok: false, code: error.code, message: error.message };
    }
    console.error("[billing]", error);
    return { ok: false, code: "server_error", message: "Something went wrong. Please try again." };
  }
}

export const getBillingOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingResult<BillingOverview>> => {
    const { getBillingOverview } = await import("./billing.server");
    return guard(() => getBillingOverview(context.userId));
  });

export const createPaymentOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { purpose: "topup" | "pack"; planId?: string; amountPaise?: number }) => input)
  .handler(async ({ data, context }) => {
    const { createOrder } = await import("./billing.server");
    return guard(() =>
      createOrder({
        userId: context.userId,
        purpose: data.purpose === "pack" ? "pack" : "topup",
        ...(data.planId ? { planId: data.planId } : {}),
        ...(data.amountPaise != null ? { amountPaise: data.amountPaise } : {}),
      }),
    );
  });

export const verifyPaymentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; paymentId: string; signature: string }) => input)
  .handler(async ({ data, context }) => {
    const { verifyPayment } = await import("./billing.server");
    return guard(() =>
      verifyPayment({
        userId: context.userId,
        orderId: data.orderId,
        paymentId: data.paymentId,
        signature: data.signature,
      }),
    );
  });

export const buyPackWithWalletFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { planId: string; idempotencyKey: string }) => input)
  .handler(async ({ data, context }) => {
    const { buyPackWithWallet } = await import("./billing.server");
    return guard(() =>
      buyPackWithWallet({
        userId: context.userId,
        planId: data.planId,
        idempotencyKey: data.idempotencyKey,
      }),
    );
  });
