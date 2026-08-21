// Loads the Razorpay Checkout script on demand (browser only) and opens it.
// The Key ID is public; the Key Secret never leaves the server.

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  theme?: { color?: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on?: (event: string, handler: (payload: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SRC = "https://checkout.razorpay.com/v1/checkout.js";

export async function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.Razorpay));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface CheckoutArgs {
  keyId: string;
  orderId: string;
  amountPaise: number;
  description: string;
}

export type CheckoutOutcome =
  | { status: "paid"; orderId: string; paymentId: string; signature: string }
  | { status: "cancelled" }
  | { status: "failed"; reason: string };

/** Reads a human-readable reason out of Razorpay's payment.failed payload. */
function failureReason(payload: unknown): string {
  const error = (payload as { error?: Record<string, unknown> } | null)?.error;
  const description = typeof error?.["description"] === "string" ? error["description"] : "";
  const reason = typeof error?.["reason"] === "string" ? error["reason"] : "";
  const text = description || reason;
  if (!text) return "Your bank declined the payment. No money was taken.";
  return text.endsWith(".") ? text : `${text}.`;
}

/**
 * Opens Razorpay Checkout and always resolves with an outcome — paid,
 * cancelled by the user, or failed at the bank/provider. It never leaves the
 * caller hanging, so pending UI state can always be cleared.
 */
export async function openCheckout(args: CheckoutArgs): Promise<CheckoutOutcome> {
  const ready = await loadRazorpay();
  if (!ready || !window.Razorpay) {
    return {
      status: "failed",
      reason: "Could not load the secure payment window. Check your connection and try again.",
    };
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    try {
      const checkout = new window.Razorpay!({
        key: args.keyId,
        amount: args.amountPaise,
        currency: "INR",
        name: "DataTransfer",
        description: args.description,
        order_id: args.orderId,
        theme: { color: "#2563eb" },
        handler: (response) =>
          finish({
            status: "paid",
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        modal: { ondismiss: () => finish({ status: "cancelled" }) },
      });
      checkout.on?.("payment.failed", (payload) =>
        finish({ status: "failed", reason: failureReason(payload) }),
      );
      checkout.open();
    } catch {
      finish({ status: "failed", reason: "Payment could not be started. Please try again." });
    }
  });
}
