// Server-only billing core: Razorpay orders, payment verification, wallet
// ledger and transfer packs. Never imported by client code directly.
import {
  WALLET_MAX_PAISE,
  WALLET_MIN_PAISE,
  findPack,
  type BillingOverview,
  type CreditSummary,
  type WalletTxn,
} from "./pricing";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export class BillingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function credentials() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) {
    throw new BillingError(
      "not_configured",
      "Payments are not configured yet. Please try again shortly.",
    );
  }
  return { keyId, keySecret };
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Coarse per-user rate limit backed by the orders table. Orders the user
 * explicitly cancelled don't count, so backing out of checkout never blocks
 * an immediate retry.
 */
async function assertNotFlooding(userId: string) {
  const client = await db();
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await client
    .from("payment_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("status", "cancelled")
    .gte("created_at", since);
  if ((count ?? 0) >= 8) {
    throw new BillingError("rate_limited", "Too many payment attempts. Please wait a minute.");
  }
}

/**
 * Closes out an order the user cancelled or that failed at the bank. Purely
 * bookkeeping: nothing was credited and no capacity was ever reserved, so this
 * only moves the row out of "created" and leaves an audit trail.
 */
export async function closeOrder(args: {
  userId: string;
  orderId: string;
  outcome: "cancelled" | "failed";
  reason?: string;
}) {
  const client = await db();
  if (!/^[\w-]{6,64}$/.test(args.orderId)) {
    throw new BillingError("invalid_payment", "That payment reference is not valid.");
  }
  const { data } = await client
    .from("payment_orders")
    .update({ status: args.outcome })
    .eq("provider_order_id", args.orderId)
    .eq("user_id", args.userId)
    .eq("status", "created")
    .select("id, purpose")
    .maybeSingle();
  if (args.reason) {
    console.info("[billing] order %s %s: %s", args.orderId, args.outcome, args.reason.slice(0, 200));
  }
  return { closed: Boolean(data), outcome: args.outcome };
}

async function ensureWallet(userId: string) {
  const client = await db();
  await client.from("wallets").upsert({ user_id: userId }, { onConflict: "user_id" });
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export async function getBillingOverview(userId: string): Promise<BillingOverview> {
  const client = await db();
  await ensureWallet(userId);
  const [{ data: wallet }, { data: txns }, { data: credits }] = await Promise.all([
    client.from("wallets").select("balance_paise").eq("user_id", userId).maybeSingle(),
    client
      .from("wallet_transactions")
      .select("id, kind, amount_paise, balance_after_paise, description, reference, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
    client
      .from("transfer_credits")
      .select(
        "id, plan_id, label, bytes_total, bytes_used, max_participants, max_duration_minutes, status, paid_with, transfer_id, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  return {
    balancePaise: Number(wallet?.balance_paise ?? 0),
    transactions: (txns ?? []).map(
      (t): WalletTxn => ({
        id: t.id,
        kind: t.kind as WalletTxn["kind"],
        amountPaise: Number(t.amount_paise),
        balanceAfterPaise: Number(t.balance_after_paise),
        description: t.description,
        reference: t.reference,
        createdAt: t.created_at,
      }),
    ),
    credits: (credits ?? []).map(
      (c): CreditSummary => ({
        id: c.id,
        planId: c.plan_id,
        label: c.label,
        bytesTotal: Number(c.bytes_total),
        bytesUsed: Number(c.bytes_used),
        maxParticipants: c.max_participants,
        maxDurationMinutes: c.max_duration_minutes,
        status: c.status as CreditSummary["status"],
        paidWith: c.paid_with as CreditSummary["paidWith"],
        transferId: c.transfer_id,
        createdAt: c.created_at,
      }),
    ),
  };
}

/* ------------------------------------------------------------------ */
/* Razorpay orders                                                     */
/* ------------------------------------------------------------------ */

export async function createOrder(args: {
  userId: string;
  purpose: "topup" | "pack";
  planId?: string;
  amountPaise?: number;
}) {
  const client = await db();
  const { keyId, keySecret } = credentials();
  await assertNotFlooding(args.userId);

  let amountPaise: number;
  let planId: string | null = null;
  let description: string;

  if (args.purpose === "pack") {
    const pack = findPack(String(args.planId ?? ""));
    if (!pack) throw new BillingError("invalid_plan", "That transfer pack is not available.");
    amountPaise = pack.pricePaise;
    planId = pack.id;
    description = `${pack.label} transfer`;
  } else {
    amountPaise = Math.round(Number(args.amountPaise ?? 0));
    if (!Number.isInteger(amountPaise) || amountPaise < WALLET_MIN_PAISE || amountPaise > WALLET_MAX_PAISE) {
      throw new BillingError("invalid_amount", "Wallet top-ups must be between ₹100 and ₹1,000.");
    }
    description = "Wallet top-up";
  }

  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      authorization: basicAuth(keyId, keySecret),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `dt_${Date.now().toString(36)}`,
      notes: { purpose: args.purpose, plan_id: planId ?? "", user_id: args.userId },
    }),
  });
  if (!response.ok) {
    console.error("[razorpay] order failed", response.status, await response.text());
    throw new BillingError("provider_error", "The payment provider rejected this request.");
  }
  const order = (await response.json()) as { id: string; amount: number };

  const { error } = await client.from("payment_orders").insert({
    user_id: args.userId,
    provider_order_id: order.id,
    purpose: args.purpose,
    plan_id: planId,
    amount_paise: amountPaise,
    status: "created",
  });
  if (error) throw new BillingError("server_error", "Could not start the payment.");

  return { orderId: order.id, amountPaise, keyId, description, purpose: args.purpose };
}

/**
 * Verifies a Razorpay checkout result server-side, then applies it exactly once.
 */
export async function verifyPayment(args: {
  userId: string;
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const client = await db();
  const { keyId, keySecret } = credentials();

  if (!/^[\w-]{6,64}$/.test(args.orderId) || !/^[\w-]{6,64}$/.test(args.paymentId)) {
    throw new BillingError("invalid_payment", "That payment reference is not valid.");
  }

  const expected = await hmacSha256Hex(keySecret, `${args.orderId}|${args.paymentId}`);
  if (!timingSafeEqual(expected, (args.signature ?? "").toLowerCase())) {
    throw new BillingError("invalid_signature", "This payment could not be verified.");
  }

  const { data: order } = await client
    .from("payment_orders")
    .select("id, user_id, purpose, plan_id, amount_paise, status")
    .eq("provider_order_id", args.orderId)
    .maybeSingle();
  if (!order || order.user_id !== args.userId) {
    throw new BillingError("not_found", "We could not find that payment.");
  }
  if (order.status === "paid") {
    return { applied: false, alreadyProcessed: true as const };
  }

  // Confirm with Razorpay that the money was actually captured.
  const payRes = await fetch(`${RAZORPAY_API}/payments/${args.paymentId}`, {
    headers: { authorization: basicAuth(keyId, keySecret) },
  });
  if (!payRes.ok) throw new BillingError("provider_error", "Could not confirm the payment.");
  const payment = (await payRes.json()) as {
    order_id: string;
    amount: number;
    status: string;
    currency: string;
  };
  if (
    payment.order_id !== args.orderId ||
    payment.currency !== "INR" ||
    Number(payment.amount) !== Number(order.amount_paise) ||
    !["captured", "authorized"].includes(payment.status)
  ) {
    throw new BillingError("invalid_payment", "This payment does not match the order.");
  }

  // Claim the order exactly once.
  const { data: claimed } = await client
    .from("payment_orders")
    .update({
      status: "paid",
      provider_payment_id: args.paymentId,
      verified_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "created")
    .select("id")
    .maybeSingle();
  if (!claimed) return { applied: false, alreadyProcessed: true as const };

  if (order.purpose === "topup") {
    const balance = await creditWallet(
      args.userId,
      Number(order.amount_paise),
      "topup",
      "Wallet top-up",
      `rzp:${args.paymentId}`,
    );
    return { applied: true, kind: "topup" as const, balancePaise: balance };
  }

  const pack = findPack(String(order.plan_id ?? ""));
  if (!pack) throw new BillingError("invalid_plan", "That transfer pack is no longer available.");
  const credit = await grantCredit(args.userId, pack.id, "razorpay", `rzp:${args.paymentId}`);
  return { applied: true, kind: "pack" as const, creditId: credit.id, label: pack.label };
}

async function creditWallet(
  userId: string,
  amountPaise: number,
  kind: "topup" | "refund",
  description: string,
  reference: string,
): Promise<number> {
  const client = await db();
  const { data, error } = await client.rpc("wallet_credit", {
    _user_id: userId,
    _amount_paise: amountPaise,
    _kind: kind,
    _description: description,
    _reference: reference,
  });
  if (error) {
    if (error.message.includes("duplicate_reference")) {
      const { data: wallet } = await client
        .from("wallets")
        .select("balance_paise")
        .eq("user_id", userId)
        .maybeSingle();
      return Number(wallet?.balance_paise ?? 0);
    }
    console.error("[wallet_credit]", error);
    throw new BillingError("server_error", "Could not update your wallet.");
  }
  return Number(data ?? 0);
}

/* ------------------------------------------------------------------ */
/* Transfer packs                                                      */
/* ------------------------------------------------------------------ */

async function grantCredit(
  userId: string,
  planId: string,
  paidWith: "razorpay" | "wallet",
  reference: string,
) {
  const client = await db();
  const pack = findPack(planId);
  if (!pack) throw new BillingError("invalid_plan", "That transfer pack is not available.");

  // Callers claim the payment/ledger reference before calling this, so a
  // successful call here happens at most once per payment.


  const { data, error } = await client
    .from("transfer_credits")
    .insert({
      user_id: userId,
      plan_id: pack.id,
      label: pack.label,
      bytes_total: pack.bytes,
      max_participants: pack.maxParticipants,
      max_duration_minutes: pack.maxDurationMinutes,
      price_paise: pack.pricePaise,
      paid_with: paidWith,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[grantCredit]", error, reference);
    throw new BillingError("server_error", "Payment succeeded but the pack could not be added.");
  }
  return data;
}

/** Buys a pack from the prepaid wallet. Debit and grant are both server-side. */
export async function buyPackWithWallet(args: {
  userId: string;
  planId: string;
  idempotencyKey: string;
}) {
  const client = await db();
  const pack = findPack(args.planId);
  if (!pack) throw new BillingError("invalid_plan", "That transfer pack is not available.");
  if (!/^[\w-]{8,64}$/.test(args.idempotencyKey ?? "")) {
    throw new BillingError("invalid_request", "Could not start that purchase. Please retry.");
  }
  await ensureWallet(args.userId);

  const reference = `wallet:${args.idempotencyKey}`;
  const { data: already } = await client
    .from("wallet_transactions")
    .select("id")
    .eq("user_id", args.userId)
    .eq("reference", reference)
    .maybeSingle();
  if (already) {
    const overview = await getBillingOverview(args.userId);
    return { balancePaise: overview.balancePaise, label: pack.label, duplicate: true as const };
  }

  const { data: balance, error } = await client.rpc("wallet_debit", {
    _user_id: args.userId,
    _amount_paise: pack.pricePaise,
    _description: `${pack.label} transfer`,
    _reference: reference,
  });
  if (error) {
    if (error.message.includes("insufficient_funds")) {
      throw new BillingError(
        "insufficient_funds",
        "Your wallet balance is too low. Add money or pay directly.",
      );
    }
    if (error.message.includes("duplicate_reference")) {
      const overview = await getBillingOverview(args.userId);
      return { balancePaise: overview.balancePaise, label: pack.label, duplicate: true as const };
    }
    console.error("[wallet_debit]", error);
    throw new BillingError("server_error", "Could not complete the wallet payment.");
  }

  try {
    const credit = await grantCredit(args.userId, pack.id, "wallet", reference);
    return {
      balancePaise: Number(balance ?? 0),
      label: pack.label,
      creditId: credit.id,
      duplicate: false as const,
    };
  } catch (err) {
    // Never keep money without giving capacity.
    await creditWallet(
      args.userId,
      pack.pricePaise,
      "refund",
      `Refund — ${pack.label} transfer`,
      `${reference}:refund`,
    );
    throw err;
  }
}
