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

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
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

/** Resolves with the checkout result, or null if the user dismissed it. */
export async function openCheckout(args: CheckoutArgs): Promise<{
  orderId: string;
  paymentId: string;
  signature: string;
} | null> {
  const ready = await loadRazorpay();
  if (!ready || !window.Razorpay) {
    throw new Error("Could not load the secure payment window. Check your connection.");
  }
  return new Promise((resolve, reject) => {
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
          resolve({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          }),
        modal: { ondismiss: () => resolve(null) },
      });
      checkout.open();
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Payment could not be started."));
    }
  });
}
