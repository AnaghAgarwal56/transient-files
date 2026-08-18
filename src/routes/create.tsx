import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Copy, Loader2, Settings2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/QrCode";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveSession } from "@/lib/session";
import { useAuth } from "@/hooks/useAuth";
import { getBillingOverviewFn } from "@/lib/billing.functions";
import { PAID_DURATIONS, formatInr } from "@/lib/pricing";
import { useQuery } from "@tanstack/react-query";
import {
  EXPIRY_OPTIONS,
  MAX_USER_OPTIONS,
  formatBytes,
  formatCountdown,
  type DeletePolicy,
  type Permission,
} from "@/lib/transfer-types";
import { createPaidTransferFn, createTransferFn } from "@/lib/transfers.functions";

export const Route = createFileRoute("/create")({
  validateSearch: (search: Record<string, unknown>): { credit?: string } =>
    typeof search['credit'] === "string" ? { credit: search['credit'] } : {},
  head: () => ({
    meta: [
      { title: "Create a Transfer — DataTransfer" },
      {
        name: "description",
        content:
          "Create a temporary transfer room: choose an expiry and device limit, then share the room ID, PIN or QR code.",
      },
      { property: "og:title", content: "Create a Transfer — DataTransfer" },
      {
        property: "og:description",
        content: "Generate a temporary room ID, access PIN and QR code in one tap. No account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

interface Created {
  roomId: string;
  pin: string;
  token: string;
  displayName: string;
  expiresAt: string;
  shareUrl: string;
  tier: string;
  capacityBytes: number;
}

function CreatePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { signedIn } = useAuth();
  const createFn = useServerFn(createTransferFn);
  const createPaidFn = useServerFn(createPaidTransferFn);
  const overviewFn = useServerFn(getBillingOverviewFn);
  const [created, setCreated] = useState<Created | null>(null);

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [expiryMinutes, setExpiryMinutes] = useState(240);
  const [maxUsers, setMaxUsers] = useState(2);
  const [upload, setUpload] = useState<Permission>("everyone");
  const [download, setDownload] = useState<Permission>("everyone");
  const [deletePolicy, setDeletePolicy] = useState<DeletePolicy>("owner");
  const [retentionMinutes, setRetentionMinutes] = useState(1440);
  const [advanced, setAdvanced] = useState(false);

  const { data: billing } = useQuery({
    queryKey: ["billing"],
    queryFn: () => overviewFn({ data: undefined as never }),
    enabled: signedIn,
  });
  const credits = billing?.ok
    ? billing.data.credits.filter((credit) => credit.status === "unused")
    : [];
  const selectedCredit = search.credit
    ? credits.find((credit) => credit.id === search.credit)
    : undefined;

  const expiryChoices = selectedCredit
    ? PAID_DURATIONS.filter((option) => option.minutes <= selectedCredit.maxDurationMinutes)
    : EXPIRY_OPTIONS;
  const userChoices = selectedCredit
    ? [2, 5, 10, 20].filter((n) => n <= selectedCredit.maxParticipants)
    : MAX_USER_OPTIONS;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        displayName,
        expiryMinutes,
        maxUsers,
        upload,
        download,
        deletePolicy,
        retentionMinutes,
        origin: window.location.origin,
      };
      return selectedCredit
        ? createPaidFn({ data: { ...payload, creditId: selectedCredit.id } })
        : createFn({ data: payload });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      saveSession({
        roomId: result.data.roomId,
        token: result.data.token,
        displayName: result.data.displayName,
      });
      setCreated(result.data);
    },
    onError: () => toast.error("Network error — could not reach the server."),
  });

  if (created) {
    return (
      <CreatedPanel
        created={created}
        onEnter={() => navigate({ to: "/room/$roomId", params: { roomId: created.roomId } })}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold">Create Transfer</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        No account, no email. You&apos;ll get a room ID, an access PIN and a QR code.
      </p>

      <form
        className="panel mt-8 space-y-6 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transfer name (optional)">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Photos from the library PC"
              maxLength={60}
            />
          </Field>
          <Field label="Your display name (optional)">
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Auto: User-4821"
              maxLength={24}
            />
          </Field>
          <Field label="Expiration time">
            <Select
              value={String(expiryMinutes)}
              onValueChange={(value) => setExpiryMinutes(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.minutes} value={String(option.minutes)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Maximum users">
            <Select value={String(maxUsers)} onValueChange={(value) => setMaxUsers(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_USER_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} {option === 1 ? "device (just me)" : "devices"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-primary"
        >
          <Settings2 className="size-4" />
          {advanced ? "Hide" : "Show"} permissions &amp; retention
        </button>

        {advanced && (
          <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
            <Field label="Upload permission">
              <Select value={upload} onValueChange={(v) => setUpload(v as Permission)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="owner">Owner only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Download permission">
              <Select value={download} onValueChange={(v) => setDownload(v as Permission)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="owner">Owner only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="File deletion">
              <Select value={deletePolicy} onValueChange={(v) => setDeletePolicy(v as DeletePolicy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner only</SelectItem>
                  <SelectItem value="anyone">Anyone in the room</SelectItem>
                  <SelectItem value="confirm">Require everyone to confirm</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Retention after expiry">
              <Select
                value={String(retentionMinutes)}
                onValueChange={(v) => setRetentionMinutes(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="360">6 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                  <SelectItem value="4320">3 days</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              After the room expires the files stay encrypted and unreachable until deletion is
              confirmed, or until the retention window ends.
            </p>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Create Transfer
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have a code?{" "}
        <Link to="/join" className="text-primary hover:underline">
          Join a transfer
        </Link>
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function CreatedPanel({ created, onEnter }: { created: Created; onEnter: () => void }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(created.expiresAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(0, new Date(created.expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => window.clearInterval(id);
  }, [created.expiresAt]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-success/15 text-success">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Transfer created</h1>
          <p className="text-sm text-muted-foreground">
            Write these down or scan the QR on your other device.
          </p>
        </div>
      </div>

      <div className="panel mt-8 p-6">
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="space-y-5">
            <CodeRow label="Room ID" value={created.roomId} />
            <CodeRow label="Access PIN" value={created.pin} />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Expires in</p>
              <p className="code-chip mt-1 text-2xl font-semibold text-primary">
                {formatCountdown(remaining)}
              </p>
            </div>
            <StatusBadge tone="active">Active</StatusBadge>
          </div>
          <div className="flex flex-col items-center gap-3">
            <QrCode value={created.shareUrl} />
            <CopyButton value={created.shareUrl} label="Copy Link" />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <CopyButton value={created.roomId} label="Copy Room ID" />
          <CopyButton value={created.pin} label="Copy PIN" />
        </div>

        <Button size="lg" className="mt-6 w-full" onClick={onEnter}>
          Enter Room <ArrowRight className="ml-1 size-4" />
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        The PIN is shown only now — it is stored as a salted hash and cannot be recovered.
      </p>
    </main>
  );
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="code-chip mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Copying isn't available — select the text manually.");
        }
      }}
    >
      {copied ? <Check className="mr-1.5 size-3.5" /> : <Copy className="mr-1.5 size-3.5" />}
      {label}
    </Button>
  );
}
