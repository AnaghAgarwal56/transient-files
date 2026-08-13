// Client-safe shared types & constants for DataTransfer.

export const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MB per file

export const BLOCKED_EXTENSIONS = [
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "cpl",
  "jar",
  "js",
  "vbs",
  "ps1",
  "sh",
  "php",
  "dll",
  "app",
  "apk_unsigned",
];

export const EXPIRY_OPTIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
];

export const MAX_USER_OPTIONS = [1, 2, 5, 10];

export type Permission = "everyone" | "owner";
export type DeletePolicy = "owner" | "anyone" | "confirm";

export type RoomStatus = "active" | "expired" | "deleted" | "ended";

export interface TransferCredentials {
  roomId: string;
  pin: string;
  token: string;
  displayName: string;
  expiresAt: string;
  shareUrl: string;
}

export interface RoomFile {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  uploadedByName: string;
  uploadedAt: string;
  isMine: boolean;
}

export interface RoomParticipant {
  id: string;
  displayName: string;
  role: "owner" | "participant";
  revoked: boolean;
  isMe: boolean;
  confirmedDeletion: boolean;
}

export interface RoomActivity {
  id: string;
  actorName: string;
  action: string;
  createdAt: string;
}

export interface RoomState {
  roomId: string;
  name: string | null;
  status: RoomStatus;
  expiresAt: string;
  deletionAt: string | null;
  maxUsers: number;
  retentionMinutes: number;
  settings: {
    upload: Permission;
    download: Permission;
    delete: DeletePolicy;
  };
  me: { id: string; displayName: string; role: "owner" | "participant" };
  participants: RoomParticipant[];
  files: RoomFile[];
  activity: RoomActivity[];
  deletionProgress: { confirmed: number; total: number };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function fileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : "";
}
