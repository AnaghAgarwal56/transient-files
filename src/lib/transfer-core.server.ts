// Server-only core logic for DataTransfer. Never imported by client code
// directly: only *.functions.ts handlers load this module.
import {
  BLOCKED_EXTENSIONS,
  MAX_FILE_BYTES,
  fileExtension,
  type DeletePolicy,
  type Permission,
  type RoomState,
  type RoomStatus,
} from "./transfer-types";

const BUCKET = "transfer-files";
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PIN_ATTEMPTS = 5;
const LOCK_MINUTES = 10;

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function db(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export class TransferError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

function randomCode(length: number, alphabet: string): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

function randomToken(): string {
  return toHex(randomBytes(32));
}

function tempName(): string {
  return `User-${randomCode(4, "0123456789")}`;
}

function sanitizeName(input: string | undefined, fallback: string): string {
  const cleaned = (input ?? "").replace(/[^\p{L}\p{N} _.-]/gu, "").trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 24) : fallback;
}

function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\p{L}\p{N}. _()+-]/gu, "_").slice(0, 120);
  return cleaned.length ? cleaned : "file";
}

async function log(transferId: string, actorName: string, action: string, participantId?: string) {
  const client = await db();
  await client.from("activity_logs").insert({
    transfer_id: transferId,
    participant_id: participantId ?? null,
    actor_name: actorName,
    action,
  });
}

/* ------------------------------------------------------------------ */
/* Room lifecycle                                                      */
/* ------------------------------------------------------------------ */

export interface CreateInput {
  name?: string;
  expiryMinutes: number;
  maxUsers: number;
  displayName?: string;
  upload?: Permission;
  download?: Permission;
  deletePolicy?: DeletePolicy;
  retentionMinutes?: number;
  origin: string;
  /** Present when the room is created by a signed-in account. */
  ownerUserId?: string;
  /** A purchased transfer pack to attach to this room. */
  creditId?: string;
}

const ALLOWED_EXPIRY = [30, 60, 240, 600, 1440, 4320, 10080];
const ALLOWED_RETENTION = [60, 360, 1440, 4320];

interface CreditRow {
  id: string;
  label: string;
  bytes_total: number;
  bytes_used: number;
  max_participants: number;
  max_duration_minutes: number;
  status: string;
}

export async function createTransfer(input: CreateInput) {
  const client = await db();

  // Resolve the paid pack (if any) server-side — the client never decides capacity.
  let credit: CreditRow | null = null;
  if (input.creditId) {
    if (!input.ownerUserId) {
      throw new TransferError("unauthorized", "Sign in to use a purchased transfer.");
    }
    const { data } = await client
      .from("transfer_credits")
      .select("id, label, bytes_total, bytes_used, max_participants, max_duration_minutes, status")
      .eq("id", input.creditId)
      .eq("user_id", input.ownerUserId)
      .maybeSingle();
    if (!data) throw new TransferError("not_found", "That purchased transfer could not be found.");
    if (data.status !== "unused") {
      throw new TransferError("credit_used", "That transfer has already been used for a room.");
    }
    credit = data as CreditRow;
  }

  const capacityBytes = credit
    ? Math.max(0, Number(credit.bytes_total) - Number(credit.bytes_used))
    : FREE_MAX_TRANSFER_BYTES;
  const maxParticipants = credit ? credit.max_participants : FREE_MAX_PARTICIPANTS;
  const maxLifetime = credit ? credit.max_duration_minutes : FREE_LIFETIME_MINUTES;

  const requestedExpiry = ALLOWED_EXPIRY.includes(input.expiryMinutes) ? input.expiryMinutes : 240;
  const expiryMinutes = Math.min(requestedExpiry, maxLifetime);
  const requestedUsers = Number.isInteger(input.maxUsers) ? input.maxUsers : 2;
  const maxUsers = Math.min(Math.max(1, requestedUsers), maxParticipants);
  const retention = ALLOWED_RETENTION.includes(input.retentionMinutes ?? 1440)
    ? (input.retentionMinutes ?? 1440)
    : 1440;


  const pin = randomCode(4, "0123456789");
  const salt = toHex(randomBytes(16));
  const pinHash = await sha256(`${salt}:${pin}`);

  let roomId = "";
  let inserted: { id: string; expires_at: string } | null = null;
  for (let attempt = 0; attempt < 6 && !inserted; attempt += 1) {
    roomId = randomCode(6, ROOM_ALPHABET);
    const { data, error } = await client
      .from("transfers")
      .insert({
        room_id: roomId,
        name: input.name?.trim() ? input.name.trim().slice(0, 60) : null,
        pin_hash: pinHash,
        pin_salt: salt,
        max_users: maxUsers,
        upload_permission: input.upload === "owner" ? "owner" : "everyone",
        download_permission: input.download === "owner" ? "owner" : "everyone",
        delete_permission: (["owner", "anyone", "confirm"] as string[]).includes(
          input.deletePolicy ?? "",
        )
          ? (input.deletePolicy as string)
          : "owner",
        retention_minutes: retention,
        expires_at: new Date(Date.now() + expiryMinutes * 60_000).toISOString(),
      })
      .select("id, expires_at")
      .single();
    if (!error && data) inserted = data;
    else if (error && !error.message.includes("duplicate")) {
      throw new TransferError("server_error", "Could not create the transfer. Please try again.");
    }
  }
  if (!inserted) throw new TransferError("server_error", "Could not create the transfer.");

  const displayName = sanitizeName(input.displayName, tempName());
  const token = randomToken();
  const { data: participant, error: pErr } = await client
    .from("participants")
    .insert({
      transfer_id: inserted.id,
      display_name: displayName,
      role: "owner",
      token_hash: await sha256(token),
    })
    .select("id")
    .single();
  if (pErr || !participant) throw new TransferError("server_error", "Could not create the owner session.");

  await log(inserted.id, displayName, "created the room", participant.id);

  return {
    roomId,
    pin,
    token,
    displayName,
    expiresAt: inserted.expires_at,
    shareUrl: `${input.origin}/join?room=${roomId}`,
  };
}

async function refreshStatus(transfer: TransferRow): Promise<TransferRow> {
  if (transfer.status !== "active") return transfer;
  if (new Date(transfer.expires_at).getTime() > Date.now()) return transfer;
  const client = await db();
  const deletionAt = new Date(
    new Date(transfer.expires_at).getTime() + transfer.retention_minutes * 60_000,
  ).toISOString();
  const { data } = await client
    .from("transfers")
    .update({ status: "expired", deletion_at: deletionAt })
    .eq("id", transfer.id)
    .select("*")
    .single();
  await log(transfer.id, "System", "room expired");
  return (data as TransferRow | null) ?? { ...transfer, status: "expired", deletion_at: deletionAt };
}

interface TransferRow {
  id: string;
  room_id: string;
  name: string | null;
  pin_hash: string;
  pin_salt: string;
  status: string;
  max_users: number;
  upload_permission: string;
  download_permission: string;
  delete_permission: string;
  retention_minutes: number;
  expires_at: string;
  deletion_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
}

interface ParticipantRow {
  id: string;
  transfer_id: string;
  display_name: string;
  role: string;
  revoked: boolean;
}

export async function joinTransfer(args: {
  roomId: string;
  pin: string;
  displayName?: string;
}) {
  const client = await db();
  const roomId = (args.roomId ?? "").trim().toUpperCase().slice(0, 12);
  const pin = (args.pin ?? "").trim();
  if (!/^[A-Z0-9]{4,12}$/.test(roomId)) {
    throw new TransferError("invalid_room", "That room ID doesn't look right.");
  }
  if (!/^\d{4,8}$/.test(pin)) {
    throw new TransferError("invalid_pin", "The access PIN must be 4 digits.");
  }

  const { data: found } = await client.from("transfers").select("*").eq("room_id", roomId).maybeSingle();
  if (!found) throw new TransferError("invalid_room", "No transfer found with that room ID.");
  let transfer = found as TransferRow;

  if (transfer.locked_until && new Date(transfer.locked_until).getTime() > Date.now()) {
    throw new TransferError(
      "locked",
      "Too many incorrect PIN attempts. Please try again in a few minutes.",
    );
  }

  transfer = await refreshStatus(transfer);
  if (transfer.status === "deleted") {
    throw new TransferError("deleted", "The files in this transfer have been permanently deleted.");
  }
  if (transfer.status !== "active") {
    throw new TransferError("expired", "This transfer has expired and is no longer accepting connections.");
  }

  const attemptHash = await sha256(`${transfer.pin_salt}:${pin}`);
  if (attemptHash !== transfer.pin_hash) {
    const attempts = transfer.failed_attempts + 1;
    await client
      .from("transfers")
      .update({
        failed_attempts: attempts,
        locked_until:
          attempts >= MAX_PIN_ATTEMPTS
            ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString()
            : null,
      })
      .eq("id", transfer.id);
    if (attempts >= MAX_PIN_ATTEMPTS) {
      throw new TransferError(
        "locked",
        `Too many incorrect PIN attempts. Access blocked for ${LOCK_MINUTES} minutes.`,
      );
    }
    throw new TransferError("invalid_pin", "That access PIN is incorrect.");
  }

  const { count } = await client
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("transfer_id", transfer.id)
    .eq("revoked", false);
  if ((count ?? 0) >= transfer.max_users) {
    throw new TransferError("room_full", "This room is full and cannot accept more devices.");
  }

  const displayName = sanitizeName(args.displayName, tempName());
  const token = randomToken();
  const { data: participant, error } = await client
    .from("participants")
    .insert({
      transfer_id: transfer.id,
      display_name: displayName,
      role: "participant",
      token_hash: await sha256(token),
    })
    .select("id")
    .single();
  if (error || !participant) throw new TransferError("server_error", "Could not join the room.");

  await client
    .from("transfers")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", transfer.id);
  await log(transfer.id, displayName, "joined", participant.id);

  return { roomId: transfer.room_id, token, displayName, expiresAt: transfer.expires_at };
}

interface Session {
  transfer: TransferRow;
  participant: ParticipantRow;
}

async function authorize(token: string, opts: { allowExpired?: boolean } = {}): Promise<Session> {
  const client = await db();
  if (!/^[0-9a-f]{64}$/.test(token ?? "")) {
    throw new TransferError("unauthorized", "Your session is no longer valid. Please join again.");
  }
  const { data: participant } = await client
    .from("participants")
    .select("id, transfer_id, display_name, role, revoked")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!participant) {
    throw new TransferError("unauthorized", "Your session is no longer valid. Please join again.");
  }
  if (participant.revoked) {
    throw new TransferError("revoked", "Your access to this room has been revoked.");
  }
  const { data: row } = await client
    .from("transfers")
    .select("*")
    .eq("id", participant.transfer_id)
    .single();
  if (!row) throw new TransferError("invalid_room", "This transfer no longer exists.");

  const transfer = await refreshStatus(row as TransferRow);
  if (!opts.allowExpired && transfer.status !== "active") {
    throw new TransferError("expired", "This transfer has expired. The room is closed.");
  }
  await client
    .from("participants")
    .update({ last_active: new Date().toISOString() })
    .eq("id", participant.id);
  return { transfer, participant: participant as ParticipantRow };
}

export async function getRoomState(token: string): Promise<RoomState> {
  const client = await db();
  const { transfer, participant } = await authorize(token, { allowExpired: true });

  const [{ data: participants }, { data: files }, { data: activity }, { data: confirmations }] =
    await Promise.all([
      client
        .from("participants")
        .select("id, display_name, role, revoked")
        .eq("transfer_id", transfer.id)
        .order("joined_at", { ascending: true }),
      client
        .from("files")
        .select("id, filename, size, mime_type, uploaded_by, uploaded_by_name, uploaded_at")
        .eq("transfer_id", transfer.id)
        .eq("ready", true)
        .order("uploaded_at", { ascending: false }),
      client
        .from("activity_logs")
        .select("id, actor_name, action, created_at")
        .eq("transfer_id", transfer.id)
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("deletion_confirmations")
        .select("participant_id, confirmed")
        .eq("transfer_id", transfer.id),
    ]);

  const confirmedIds = new Set(
    (confirmations ?? []).filter((c) => c.confirmed).map((c) => c.participant_id),
  );
  const active = (participants ?? []).filter((p) => !p.revoked);

  return {
    roomId: transfer.room_id,
    name: transfer.name,
    status: transfer.status as RoomStatus,
    expiresAt: transfer.expires_at,
    deletionAt: transfer.deletion_at,
    maxUsers: transfer.max_users,
    retentionMinutes: transfer.retention_minutes,
    settings: {
      upload: transfer.upload_permission as Permission,
      download: transfer.download_permission as Permission,
      delete: transfer.delete_permission as DeletePolicy,
    },
    me: {
      id: participant.id,
      displayName: participant.display_name,
      role: participant.role as "owner" | "participant",
    },
    participants: (participants ?? []).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      role: p.role as "owner" | "participant",
      revoked: p.revoked,
      isMe: p.id === participant.id,
      confirmedDeletion: confirmedIds.has(p.id),
    })),
    files: (files ?? []).map((f) => ({
      id: f.id,
      filename: f.filename,
      size: Number(f.size),
      mimeType: f.mime_type,
      uploadedByName: f.uploaded_by_name,
      uploadedAt: f.uploaded_at,
      isMine: f.uploaded_by === participant.id,
    })),
    activity: (activity ?? []).map((a) => ({
      id: a.id,
      actorName: a.actor_name,
      action: a.action,
      createdAt: a.created_at,
    })),
    deletionProgress: {
      confirmed: active.filter((p) => confirmedIds.has(p.id)).length,
      total: active.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

export async function requestUpload(args: {
  token: string;
  filename: string;
  size: number;
  mimeType: string;
}) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  if (transfer.upload_permission === "owner" && participant.role !== "owner") {
    throw new TransferError("forbidden", "Only the room owner can upload files here.");
  }

  const filename = safeFilename(args.filename);
  const size = Number(args.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw new TransferError("invalid_file", "That file appears to be empty.");
  }
  if (size > MAX_FILE_BYTES) {
    throw new TransferError("file_too_large", "Files must be 200 MB or smaller in this version.");
  }
  const ext = fileExtension(filename);
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new TransferError("unsupported_file", `“.${ext}” files are not allowed for security reasons.`);
  }
  const mimeType = /^[\w.+-]+\/[\w.+-]+$/.test(args.mimeType ?? "")
    ? args.mimeType
    : "application/octet-stream";

  const storagePath = `${transfer.id}/${toHex(randomBytes(12))}-${filename}`;
  const { data: file, error } = await client
    .from("files")
    .insert({
      transfer_id: transfer.id,
      filename,
      size,
      mime_type: mimeType,
      storage_path: storagePath,
      uploaded_by: participant.id,
      uploaded_by_name: participant.display_name,
      ready: false,
    })
    .select("id")
    .single();
  if (error || !file) throw new TransferError("upload_failed", "Could not start the upload.");

  const { data: signed, error: sErr } = await client.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath);
  if (sErr || !signed) throw new TransferError("upload_failed", "Could not start the upload.");

  return { fileId: file.id, uploadUrl: signed.signedUrl, filename };
}

export async function finalizeUpload(args: { token: string; fileId: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  const { data: file } = await client
    .from("files")
    .select("id, filename, storage_path, uploaded_by, size")
    .eq("id", args.fileId)
    .eq("transfer_id", transfer.id)
    .maybeSingle();
  if (!file || file.uploaded_by !== participant.id) {
    throw new TransferError("upload_failed", "That upload could not be verified.");
  }

  const dir = file.storage_path.split("/").slice(0, -1).join("/");
  const name = file.storage_path.split("/").pop()!;
  const { data: listed } = await client.storage.from(BUCKET).list(dir, { search: name, limit: 1 });
  const object = listed?.[0];
  if (!object) {
    await client.from("files").delete().eq("id", file.id);
    throw new TransferError("upload_failed", "The upload did not complete. Please try again.");
  }
  const actualSize = Number(
    (object.metadata as { size?: number } | null)?.size ?? file.size,
  );
  if (actualSize > MAX_FILE_BYTES) {
    await client.storage.from(BUCKET).remove([file.storage_path]);
    await client.from("files").delete().eq("id", file.id);
    throw new TransferError("file_too_large", "Files must be 200 MB or smaller in this version.");
  }

  await client.from("files").update({ ready: true, size: actualSize }).eq("id", file.id);
  await log(transfer.id, participant.display_name, `uploaded ${file.filename}`, participant.id);
  return { ok: true };
}

export async function getDownloadUrl(args: { token: string; fileId: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  if (transfer.download_permission === "owner" && participant.role !== "owner") {
    throw new TransferError("forbidden", "Only the room owner can download files here.");
  }
  const { data: file } = await client
    .from("files")
    .select("filename, storage_path")
    .eq("id", args.fileId)
    .eq("transfer_id", transfer.id)
    .eq("ready", true)
    .maybeSingle();
  if (!file) throw new TransferError("not_found", "That file is no longer available.");

  const { data: signed, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.filename });
  if (error || !signed) throw new TransferError("download_failed", "Could not prepare the download.");

  await log(transfer.id, participant.display_name, `downloaded ${file.filename}`, participant.id);
  return { url: signed.signedUrl, filename: file.filename };
}

export async function deleteFile(args: { token: string; fileId: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  const { data: file } = await client
    .from("files")
    .select("id, filename, storage_path, uploaded_by")
    .eq("id", args.fileId)
    .eq("transfer_id", transfer.id)
    .maybeSingle();
  if (!file) throw new TransferError("not_found", "That file is no longer available.");

  const isOwner = participant.role === "owner";
  const policy = transfer.delete_permission as DeletePolicy;
  const allowed =
    isOwner || policy === "anyone" || (policy === "confirm" && file.uploaded_by === participant.id);
  if (!allowed) {
    throw new TransferError("forbidden", "You don't have permission to delete this file.");
  }

  await client.storage.from(BUCKET).remove([file.storage_path]);
  await client.from("files").delete().eq("id", file.id);
  await log(transfer.id, participant.display_name, `deleted ${file.filename}`, participant.id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Room administration                                                 */
/* ------------------------------------------------------------------ */

export async function revokeParticipant(args: { token: string; participantId: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token, { allowExpired: true });
  if (participant.role !== "owner") {
    throw new TransferError("forbidden", "Only the room owner can remove participants.");
  }
  if (args.participantId === participant.id) {
    throw new TransferError("forbidden", "The owner cannot remove themselves. End the room instead.");
  }
  const { data: target } = await client
    .from("participants")
    .select("id, display_name")
    .eq("id", args.participantId)
    .eq("transfer_id", transfer.id)
    .maybeSingle();
  if (!target) throw new TransferError("not_found", "That participant is not in this room.");

  await client.from("participants").update({ revoked: true }).eq("id", target.id);
  await log(transfer.id, participant.display_name, `revoked access for ${target.display_name}`, participant.id);
  return { ok: true };
}

export async function updateSettings(args: {
  token: string;
  upload?: Permission;
  download?: Permission;
  deletePolicy?: DeletePolicy;
}) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  if (participant.role !== "owner") {
    throw new TransferError("forbidden", "Only the room owner can change room settings.");
  }
  const patch: {
    upload_permission?: string;
    download_permission?: string;
    delete_permission?: string;
  } = {};
  if (args.upload === "owner" || args.upload === "everyone") patch.upload_permission = args.upload;
  if (args.download === "owner" || args.download === "everyone")
    patch.download_permission = args.download;
  if (args.deletePolicy && ["owner", "anyone", "confirm"].includes(args.deletePolicy))
    patch.delete_permission = args.deletePolicy;
  if (Object.keys(patch).length === 0) return { ok: true };

  await client.from("transfers").update(patch).eq("id", transfer.id);
  await log(transfer.id, participant.display_name, "updated room settings", participant.id);
  return { ok: true };
}

export async function endRoom(args: { token: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token);
  if (participant.role !== "owner") {
    throw new TransferError("forbidden", "Only the room owner can end the room.");
  }
  await client
    .from("transfers")
    .update({
      status: "expired",
      expires_at: new Date().toISOString(),
      deletion_at: new Date(Date.now() + transfer.retention_minutes * 60_000).toISOString(),
    })
    .eq("id", transfer.id);
  await log(transfer.id, participant.display_name, "ended the room", participant.id);
  return { ok: true };
}

export async function confirmDeletion(args: { token: string }) {
  const client = await db();
  const { transfer, participant } = await authorize(args.token, { allowExpired: true });
  if (transfer.status === "deleted") return { deleted: true };

  await client
    .from("deletion_confirmations")
    .upsert(
      { transfer_id: transfer.id, participant_id: participant.id, confirmed: true },
      { onConflict: "transfer_id,participant_id" },
    );
  await log(transfer.id, participant.display_name, "confirmed permanent deletion", participant.id);

  const [{ data: active }, { data: confirmations }] = await Promise.all([
    client.from("participants").select("id").eq("transfer_id", transfer.id).eq("revoked", false),
    client
      .from("deletion_confirmations")
      .select("participant_id")
      .eq("transfer_id", transfer.id)
      .eq("confirmed", true),
  ]);
  const confirmedIds = new Set((confirmations ?? []).map((c) => c.participant_id));
  const activeIds = (active ?? []).map((p) => p.id);
  const policy = transfer.delete_permission as DeletePolicy;

  let satisfied = false;
  if (policy === "anyone") satisfied = true;
  else if (policy === "owner") satisfied = participant.role === "owner";
  else satisfied = activeIds.length > 0 && activeIds.every((id) => confirmedIds.has(id));

  if (!satisfied) {
    return {
      deleted: false,
      confirmed: activeIds.filter((id) => confirmedIds.has(id)).length,
      total: activeIds.length,
    };
  }

  await purgeTransfer(transfer.id);
  return { deleted: true };
}

export async function purgeTransfer(transferId: string) {
  const client = await db();
  const { data: files } = await client
    .from("files")
    .select("storage_path")
    .eq("transfer_id", transferId);
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) await client.storage.from(BUCKET).remove(paths);
  await client.from("files").delete().eq("transfer_id", transferId);
  await client
    .from("transfers")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", transferId);
  await log(transferId, "System", "files permanently deleted");
}

/** Retention sweep: purge transfers whose retention window has elapsed. */
export async function runCleanup() {
  const client = await db();
  const nowIso = new Date().toISOString();
  const { data: expiring } = await client
    .from("transfers")
    .select("id, expires_at, retention_minutes")
    .eq("status", "active")
    .lt("expires_at", nowIso);
  for (const t of expiring ?? []) {
    await client
      .from("transfers")
      .update({
        status: "expired",
        deletion_at: new Date(
          new Date(t.expires_at).getTime() + t.retention_minutes * 60_000,
        ).toISOString(),
      })
      .eq("id", t.id);
  }
  const { data: due } = await client
    .from("transfers")
    .select("id")
    .eq("status", "expired")
    .not("deletion_at", "is", null)
    .lt("deletion_at", nowIso);
  for (const t of due ?? []) await purgeTransfer(t.id);
  return { expired: (expiring ?? []).length, purged: (due ?? []).length };
}
