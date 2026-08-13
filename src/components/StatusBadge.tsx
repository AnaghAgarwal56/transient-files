import { cn } from "@/lib/utils";

export type StatusTone =
  | "active"
  | "expiring"
  | "expired"
  | "deleted"
  | "uploading"
  | "downloading"
  | "error";

const TONES: Record<StatusTone, string> = {
  active: "bg-success/15 text-success border-success/30",
  expiring: "bg-warning/15 text-warning border-warning/30",
  expired: "bg-muted text-muted-foreground border-border",
  deleted: "bg-destructive/15 text-destructive border-destructive/30",
  uploading: "bg-info/15 text-info border-info/30",
  downloading: "bg-primary/15 text-primary border-primary/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({
  tone,
  children,
  className,
  dot = true,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            (tone === "active" || tone === "uploading") && "pulse-dot",
          )}
        />
      )}
      {children}
    </span>
  );
}
