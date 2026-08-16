// Client-safe pricing catalogue. Prices are stored in paise (1 INR = 100 paise)
// so all money maths stays in integers.

export const GB = 1024 * 1024 * 1024;
export const MB = 1024 * 1024;

export const FREE_PLAN = {
  maxTransferBytes: 200 * MB,
  lifetimeMinutes: 600, // 10 hours
  maxParticipants: 2,
};

export interface TransferPack {
  id: string;
  label: string;
  bytes: number;
  pricePaise: number;
  maxParticipants: number;
  maxDurationMinutes: number;
  popular?: boolean;
}

export const TRANSFER_PACKS: TransferPack[] = [
  { id: "p500mb", label: "500 MB", bytes: 500 * MB, pricePaise: 900, maxParticipants: 5, maxDurationMinutes: 1440 },
  { id: "p1gb", label: "1 GB", bytes: 1 * GB, pricePaise: 1500, maxParticipants: 5, maxDurationMinutes: 1440, popular: true },
  { id: "p2gb", label: "2 GB", bytes: 2 * GB, pricePaise: 2500, maxParticipants: 5, maxDurationMinutes: 4320 },
  { id: "p5gb", label: "5 GB", bytes: 5 * GB, pricePaise: 4900, maxParticipants: 10, maxDurationMinutes: 4320 },
  { id: "p10gb", label: "10 GB", bytes: 10 * GB, pricePaise: 8900, maxParticipants: 10, maxDurationMinutes: 4320 },
  { id: "p25gb", label: "25 GB", bytes: 25 * GB, pricePaise: 17900, maxParticipants: 20, maxDurationMinutes: 10080 },
  { id: "p50gb", label: "50 GB", bytes: 50 * GB, pricePaise: 29900, maxParticipants: 20, maxDurationMinutes: 10080 },
  { id: "p100gb", label: "100 GB", bytes: 100 * GB, pricePaise: 49900, maxParticipants: 20, maxDurationMinutes: 10080 },
];

export function findPack(id: string): TransferPack | undefined {
  return TRANSFER_PACKS.find((p) => p.id === id);
}

export const WALLET_TOPUPS = [10000, 25000, 50000, 100000]; // ₹100 / ₹250 / ₹500 / ₹1000
export const WALLET_MIN_PAISE = 10000;
export const WALLET_MAX_PAISE = 100000;

export const PAID_DURATIONS = [
  { label: "24 hours", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
];

export const PAID_PARTICIPANTS = [2, 5, 10, 20];

export function formatInr(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface WalletTxn {
  id: string;
  kind: "topup" | "purchase" | "refund";
  amountPaise: number;
  balanceAfterPaise: number;
  description: string;
  reference: string | null;
  createdAt: string;
}

export interface CreditSummary {
  id: string;
  planId: string;
  label: string;
  bytesTotal: number;
  bytesUsed: number;
  maxParticipants: number;
  maxDurationMinutes: number;
  status: "unused" | "active" | "consumed";
  paidWith: "razorpay" | "wallet";
  transferId: string | null;
  createdAt: string;
}

export interface BillingOverview {
  balancePaise: number;
  transactions: WalletTxn[];
  credits: CreditSummary[];
}
