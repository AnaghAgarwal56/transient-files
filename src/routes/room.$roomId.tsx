import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Check,
  Copy,
  Crown,
  Download,
  FileIcon,
  Loader2,
  LogOut,
  Settings2,
  ShieldOff,
  Trash2,
  Upload,
  UserX,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { QrCode } from "@/components/QrCode";
import { StatusBadge, type StatusTone } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clearSession, loadSession } from "@/lib/session";
import {
  MAX_FILE_BYTES,
  formatBytes,
  formatCountdown,
  type DeletePolicy,
  type Permission,
  type RoomState,
} from "@/lib/transfer-types";
import {
  confirmDeletionFn,
  deleteFileFn,
  downloadUrlFn,
  endRoomFn,
  finalizeUploadFn,
  getRoomStateFn,
  requestUploadFn,
  revokeParticipantFn,
  updateSettingsFn,
} from "@/lib/transfers.functions";

export const Route = createFileRoute("/room/$roomId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Transfer Room — DataTransfer" },
      {
        name: "description",
        content:
          "Your temporary transfer dashboard: upload and download files, see connected devices and the expiry countdown.",
      },
      { property: "og:title", content: "Transfer Room — DataTransfer" },
      {
        property: "og:description",
        content: "A temporary room for uploading and downloading files across your devices.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoomPage,
});

interface UploadJob {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "error" | "done";
}

function RoomPage() {
  const { roomId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const stateFn = useServerFn(getRoomStateFn);
  const requestUpload = useServerFn(requestUploadFn);
  const finalizeUpload = useServerFn(finalizeUploadFn);
  const downloadUrl = useServerFn(downloadUrlFn);
  const removeFile = useServerFn(deleteFileFn);
  const revoke = useServerFn(revokeParticipantFn);
  const saveSettings = useServerFn(updateSettingsFn);
  const endRoom = useServerFn(endRoomFn);
  const confirmDelete = useServerFn(confirmDeletionFn);

  const [token, setToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const session = loadSession(roomId);
    if (!session) {
      setSessionError("You don't have an active session for this room.");
      return;
    }
    setToken(session.token);
  }, [roomId]);

  const query = useQuery({
    queryKey: ["room", roomId, token],
    enabled: Boolean(token),
    refetchInterval: 5000,
    queryFn: async () => {
      const result = await stateFn({ data: { token: token! } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
  });

  const state = query.data;
  const invalidate = useCallback(
    () => queryClient.refetchQueries({ queryKey: ["room", roomId] }),
    [queryClient, roomId],
  );


  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!state) return;
    const target = new Date(state.expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const shareUrl = useMemo(
    () => (typeof window === "undefined" ? "" : `${window.location.origin}/join?room=${roomId}`),
    [roomId],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!token) return;
      for (const file of files) {
        const jobId = `${file.name}-${Date.now()}-${Math.random()}`;
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name} is larger than 200 MB.`);
          continue;
        }
        setUploads((prev) => [
          ...prev,
          { id: jobId, name: file.name, progress: 0, status: "uploading" },
        ]);
        try {
          const prepared = await requestUpload({
            data: {
              token,
              filename: file.name,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
            },
          });
          if (!prepared.ok) throw new Error(prepared.message);

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", prepared.data.uploadUrl, true);
            xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
            xhr.upload.onprogress = (event) => {
              if (!event.lengthComputable) return;
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploads((prev) =>
                prev.map((job) => (job.id === jobId ? { ...job, progress } : job)),
              );
            };
            xhr.onload = () =>
              xhr.status >= 200 && xhr.status < 300
                ? resolve()
                : reject(new Error("Upload failed."));
            xhr.onerror = () => reject(new Error("Network error during upload."));
            xhr.send(file);
          });

          const finalized = await finalizeUpload({ data: { token, fileId: prepared.data.fileId } });
          if (!finalized.ok) throw new Error(finalized.message);

          setUploads((prev) =>
            prev.map((job) => (job.id === jobId ? { ...job, progress: 100, status: "done" } : job)),
          );
          window.setTimeout(
            () => setUploads((prev) => prev.filter((job) => job.id !== jobId)),
            1800,
          );
          void invalidate();
        } catch (error) {
          setUploads((prev) =>
            prev.map((job) => (job.id === jobId ? { ...job, status: "error" } : job)),
          );
          toast.error(error instanceof Error ? error.message : "Upload failed.");
        }
      }
    },
    [token, requestUpload, finalizeUpload, invalidate],
  );

  const downloadMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const result = await downloadUrl({ data: { token: token!, fileId } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.rel = "noopener";
      anchor.click();
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (sessionError) {
    return (
      <Blocked
        title="No session for this room"
        body="Temporary sessions live only on the device that joined. Enter the room ID and PIN again to reconnect."
        action={{ label: "Join with room ID and PIN", to: "/join" }}
      />
    );
  }

  if (query.isError) {
    return (
      <Blocked
        title="This room is not available"
        body={(query.error as Error).message}
        action={{ label: "Join another transfer", to: "/join" }}
        onForget={() => {
          clearSession(roomId);
          navigate({ to: "/join", search: {} });
        }}
      />
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (state.status === "deleted") {
    return (
      <Blocked
        title="Files permanently deleted"
        body="Everything in this room has been erased from storage. Nothing can be recovered."
        action={{ label: "Create a new transfer", to: "/create" }}
      />
    );
  }

  const isOwner = state.me.role === "owner";
  const expiringSoon = remaining > 0 && remaining < 5 * 60_000;
  const tone: StatusTone =
    state.status !== "active" ? "expired" : expiringSoon ? "expiring" : "active";
  const activeUsers = state.participants.filter((p) => !p.revoked).length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Room</p>
            <p className="code-chip text-2xl font-semibold sm:text-3xl">{state.roomId}</p>
            {state.name && <p className="mt-1 text-sm text-muted-foreground">{state.name}</p>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <StatusBadge tone={tone}>
              {state.status === "active" ? (expiringSoon ? "Expiring soon" : "Active") : "Expired"}
            </StatusBadge>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Expires in</p>
              <p className="code-chip text-xl font-semibold text-primary">
                {formatCountdown(remaining)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Users</p>
              <p className="code-chip text-xl font-semibold">
                {activeUsers}/{state.maxUsers}
              </p>
            </div>
          </div>
        </div>
      </div>

      {state.status !== "active" && (
        <ExpiredPanel
          state={state}
          onConfirm={async () => {
            const result = await confirmDelete({ data: { token: token! } });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(
              result.data.deleted
                ? "Files permanently deleted."
                : `Confirmation recorded (${result.data.confirmed}/${result.data.total}).`,
            );
            void invalidate();
          }}
        />
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {/* Upload */}
          {state.status === "active" &&
            (state.settings.upload === "everyone" || isOwner ? (
              <section className="panel p-5 sm:p-6">
                <h2 className="text-lg font-semibold">Upload files</h2>
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void uploadFiles(Array.from(event.dataTransfer.files));
                  }}
                  className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragging ? "border-primary bg-primary/5" : "border-border bg-surface"
                  }`}
                >
                  <Upload className="size-7 text-primary" />
                  <p className="mt-3 text-sm font-medium">Drag &amp; drop files here</p>
                  <p className="mt-1 text-xs text-muted-foreground">Up to 200 MB per file</p>
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => fileInput.current?.click()}
                  >
                    Choose Files
                  </Button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void uploadFiles(Array.from(event.target.files ?? []));
                      event.target.value = "";
                    }}
                  />
                </div>

                {uploads.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {uploads.map((job) => (
                      <li key={job.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="truncate">{job.name}</span>
                          <span className="ml-auto">
                            {job.status === "error" ? (
                              <StatusBadge tone="error">Error</StatusBadge>
                            ) : job.status === "done" ? (
                              <StatusBadge tone="active">Done</StatusBadge>
                            ) : (
                              <StatusBadge tone="uploading">{job.progress}%</StatusBadge>
                            )}
                          </span>
                        </div>
                        <Progress value={job.progress} className="mt-2 h-1.5" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section className="panel p-5 text-sm text-muted-foreground">
                Uploads in this room are restricted to the owner.
              </section>
            ))}

          {/* Files */}
          <section className="panel p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Files ({state.files.length})</h2>
            {state.files.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No files yet. Anything uploaded here appears on every joined device.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {state.files.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <FileIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.filename}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(file.size)} · {file.mimeType} · Uploaded by{" "}
                        {file.uploadedByName} · {timeAgo(file.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(state.settings.download === "everyone" || isOwner) &&
                        state.status === "active" && (
                          <Button
                            size="sm"
                            onClick={() => downloadMutation.mutate(file.id)}
                            disabled={downloadMutation.isPending}
                          >
                            <Download className="mr-1.5 size-3.5" /> Download
                          </Button>
                        )}
                      {state.status === "active" &&
                        (isOwner ||
                          state.settings.delete === "anyone" ||
                          (state.settings.delete === "confirm" && file.isMine)) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Delete ${file.filename}`}
                            onClick={async () => {
                              const result = await removeFile({
                                data: { token: token!, fileId: file.id },
                              });
                              if (!result.ok) toast.error(result.message);
                              else void invalidate();
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Activity */}
          <section className="panel p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Activity className="size-4 text-primary" /> Activity
            </h2>
            <ul className="mt-4 space-y-2 font-mono text-xs text-muted-foreground">
              {state.activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="text-foreground/70">{clockTime(entry.createdAt)}</span>
                  <span>
                    {entry.actorName} {entry.action}
                  </span>
                </li>
              ))}
              {state.activity.length === 0 && <li>No activity yet.</li>}
            </ul>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="panel flex flex-col items-center gap-3 p-5 sm:p-6">
            <QrCode value={shareUrl} size={168} />
            <p className="text-center text-xs text-muted-foreground">
              Scan to open the join page. The PIN is still required.
            </p>
            <div className="flex w-full flex-col gap-2">
              <CopyRow label="Room ID" value={state.roomId} />
              <CopyRow label="Join link" value={shareUrl} />
            </div>
          </section>

          <section className="panel p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Users className="size-4 text-primary" /> Participants
            </h2>
            <ul className="mt-4 space-y-2">
              {state.participants.map((participant) => (
                <li key={participant.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`size-2 rounded-full ${
                      participant.revoked ? "bg-neutral-status" : "bg-success pulse-dot"
                    }`}
                  />
                  <span className={participant.revoked ? "text-muted-foreground line-through" : ""}>
                    {participant.displayName}
                    {participant.isMe && " (you)"}
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {participant.role === "owner" ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Crown className="size-3" /> Owner
                      </span>
                    ) : (
                      "Participant"
                    )}
                    {isOwner && !participant.isMe && !participant.revoked && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Revoke ${participant.displayName}`}
                        onClick={async () => {
                          const result = await revoke({
                            data: { token: token!, participantId: participant.id },
                          });
                          if (!result.ok) toast.error(result.message);
                          else {
                            toast.success("Access revoked.");
                            void invalidate();
                          }
                        }}
                      >
                        <UserX className="size-3.5" />
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {isOwner && state.status === "active" && (
            <section className="panel space-y-4 p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Settings2 className="size-4 text-primary" /> Room settings
              </h2>
              <SettingRow label="Uploads">
                <Select
                  value={state.settings.upload}
                  onValueChange={async (value) => {
                    await saveSettings({ data: { token: token!, upload: value as Permission } });
                    void invalidate();
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="owner">Owner only</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Downloads">
                <Select
                  value={state.settings.download}
                  onValueChange={async (value) => {
                    await saveSettings({ data: { token: token!, download: value as Permission } });
                    void invalidate();
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="everyone">Everyone</SelectItem>
                    <SelectItem value="owner">Owner only</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Deletion">
                <Select
                  value={state.settings.delete}
                  onValueChange={async (value) => {
                    await saveSettings({
                      data: { token: token!, deletePolicy: value as DeletePolicy },
                    });
                    void invalidate();
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Owner only</SelectItem>
                    <SelectItem value="anyone">Anyone</SelectItem>
                    <SelectItem value="confirm">All confirm</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
              <Button
                variant="destructive"
                className="w-full"
                onClick={async () => {
                  const result = await endRoom({ data: { token: token! } });
                  if (!result.ok) toast.error(result.message);
                  else {
                    toast.success("Room ended. Files await deletion confirmation.");
                    void invalidate();
                  }
                }}
              >
                <ShieldOff className="mr-2 size-4" /> End room now
              </Button>
            </section>
          )}

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              clearSession(roomId);
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 size-4" /> Leave &amp; forget this device
          </Button>
        </div>
      </div>
    </main>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      className="w-full justify-between"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copying isn't available in this browser.");
        }
      }}
    >
      <span>Copy {label}</span>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function ExpiredPanel({ state, onConfirm }: { state: RoomState; onConfirm: () => void }) {
  const [pending, setPending] = useState(false);
  const policyText =
    state.settings.delete === "confirm"
      ? "All participants must confirm before files are erased."
      : state.settings.delete === "anyone"
        ? "Any participant can trigger permanent deletion."
        : "The room owner confirms permanent deletion.";

  return (
    <section className="mt-6 rounded-xl border border-warning/40 bg-warning/10 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 text-warning" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Room expired</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Access to this room is disabled. Your files are still securely stored and unreachable to
            everyone else. {policyText}
          </p>
          {state.deletionAt && (
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Automatic permanent deletion: {new Date(state.deletionAt).toLocaleString()}
            </p>
          )}

          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium">
              Deletion confirmation — {state.deletionProgress.confirmed}/
              {state.deletionProgress.total} users confirmed
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {state.participants
                .filter((p) => !p.revoked)
                .map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-32 truncate">{p.displayName}</span>
                    <span className={p.confirmedDeletion ? "text-success" : "text-muted-foreground"}>
                      {p.confirmedDeletion ? "✓ Confirmed" : "✗ Waiting"}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <Button
            variant="destructive"
            className="mt-4"
            disabled={pending}
            onClick={() => {
              setPending(true);
              onConfirm();
              window.setTimeout(() => setPending(false), 1200);
            }}
          >
            <Trash2 className="mr-2 size-4" /> Confirm Delete
          </Button>
        </div>
      </div>
    </section>
  );
}

function Blocked({
  title,
  body,
  action,
  onForget,
}: {
  title: string;
  body: string;
  action: { label: string; to: string };
  onForget?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
        <AlertTriangle className="size-6" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to={action.to}>
            {action.label}
          </Link>
        </Button>
        {onForget && (
          <Button variant="ghost" onClick={onForget}>
            Clear this session
          </Button>
        )}
      </div>
    </main>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
