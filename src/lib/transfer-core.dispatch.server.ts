// Server-only dispatcher: maps a named action to core logic and converts
// thrown TransferErrors into safe, user-readable result objects.
import {
  TransferError,
  confirmDeletion,
  createTransfer,
  deleteFile,
  endRoom,
  finalizeUpload,
  getDownloadUrl,
  getRoomState,
  joinTransfer,
  requestUpload,
  revokeParticipant,
  updateSettings,
} from "./transfer-core.server";

type Action =
  | "create"
  | "join"
  | "state"
  | "requestUpload"
  | "finalizeUpload"
  | "download"
  | "deleteFile"
  | "revoke"
  | "settings"
  | "endRoom"
  | "confirmDeletion";

export async function runAction(action: Action, data: Record<string, unknown>) {
  try {
    switch (action) {
      case "create":
        return { ok: true as const, data: await createTransfer(data as never) };
      case "join":
        return { ok: true as const, data: await joinTransfer(data as never) };
      case "state":
        return { ok: true as const, data: await getRoomState(String(data["token"] ?? "")) };
      case "requestUpload":
        return { ok: true as const, data: await requestUpload(data as never) };
      case "finalizeUpload":
        return { ok: true as const, data: await finalizeUpload(data as never) };
      case "download":
        return { ok: true as const, data: await getDownloadUrl(data as never) };
      case "deleteFile":
        return { ok: true as const, data: await deleteFile(data as never) };
      case "revoke":
        return { ok: true as const, data: await revokeParticipant(data as never) };
      case "settings":
        return { ok: true as const, data: await updateSettings(data as never) };
      case "endRoom":
        return { ok: true as const, data: await endRoom(data as never) };
      case "confirmDeletion":
        return { ok: true as const, data: await confirmDeletion(data as never) };
      default:
        return { ok: false as const, code: "server_error", message: "Unknown action." };
    }
  } catch (error) {
    if (error instanceof TransferError) {
      return { ok: false as const, code: error.code, message: error.message };
    }
    console.error("[datatransfer]", action, error);
    return {
      ok: false as const,
      code: "server_error",
      message: "Something went wrong on the server. Please try again.",
    };
  }
}
