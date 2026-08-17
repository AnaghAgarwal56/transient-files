import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DeletePolicy, Permission, RoomState } from "./transfer-types";

type Fail = { ok: false; code: string; message: string };
type Ok<T> = { ok: true; data: T };
export type Result<T> = Ok<T> | Fail;

export interface CreatedRoom {
  roomId: string;
  pin: string;
  token: string;
  displayName: string;
  expiresAt: string;
  shareUrl: string;
  tier: string;
  capacityBytes: number;
}

interface CreateArgs {
  name?: string;
  expiryMinutes: number;
  maxUsers: number;
  displayName?: string;
  upload?: Permission;
  download?: Permission;
  deletePolicy?: DeletePolicy;
  retentionMinutes?: number;
  origin: string;
}

/** Free room: 200 MB capacity, 10 hours, 2 participants (enforced server-side). */
export const createTransferFn = createServerFn({ method: "POST" })
  .inputValidator((input: CreateArgs) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("create", { ...data, creditId: undefined, ownerUserId: undefined }) as Promise<
      Result<CreatedRoom>
    >;
  });

/** Paid room: consumes one purchased transfer pack owned by the signed-in user. */
export const createPaidTransferFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateArgs & { creditId: string }) => input)
  .handler(async ({ data, context }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("create", {
      ...data,
      creditId: data.creditId,
      ownerUserId: context.userId,
    }) as Promise<Result<CreatedRoom>>;
  });

export const joinTransferFn = createServerFn({ method: "POST" })
  .inputValidator((input: { roomId: string; pin: string; displayName?: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("join", data) as Promise<
      Result<{ roomId: string; token: string; displayName: string; expiresAt: string }>
    >;
  });

export const getRoomStateFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("state", data) as Promise<Result<RoomState>>;
  });

export const requestUploadFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { token: string; filename: string; size: number; mimeType: string }) => input,
  )
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("requestUpload", data) as Promise<
      Result<{ fileId: string; uploadUrl: string; filename: string }>
    >;
  });

export const finalizeUploadFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; fileId: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("finalizeUpload", data) as Promise<Result<{ ok: boolean }>>;
  });

export const downloadUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; fileId: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("download", data) as Promise<Result<{ url: string; filename: string }>>;
  });

export const deleteFileFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; fileId: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("deleteFile", data) as Promise<Result<{ ok: boolean }>>;
  });

export const revokeParticipantFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; participantId: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("revoke", data) as Promise<Result<{ ok: boolean }>>;
  });

export const updateSettingsFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      token: string;
      upload?: Permission;
      download?: Permission;
      deletePolicy?: DeletePolicy;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("settings", data) as Promise<Result<{ ok: boolean }>>;
  });

export const endRoomFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("endRoom", data) as Promise<Result<{ ok: boolean }>>;
  });

export const confirmDeletionFn = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { runAction } = await import("./transfer-core.dispatch.server");
    return runAction("confirmDeletion", data) as Promise<
      Result<{ deleted: boolean; confirmed?: number; total?: number }>
    >;
  });
