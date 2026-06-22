import { getAdminUserListItem } from "@/features/admin/server/admin-user-read-model";
import type { CommentStatus } from "@/generated/prisma/client";
import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { prisma } from "@/lib/db/prisma";
import { parseDateInput } from "@/lib/time/parse-date-input";

type AdminUpdateUserBody = {
  isAdmin?: boolean;
  name?: unknown;
  username?: unknown;
};

type AdminCreateSuspensionInput = {
  expiresAt?: string | null;
  note?: string | null;
  reason?: string | null;
  userId: string;
};

type AdminModerateCommentInput = {
  moderationNote?: string | null;
  status: CommentStatus;
};

function normalizeAdminUserName(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || "";
}

function normalizeAdminUsername(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function buildAdminUserUpdateData(
  id: string,
  parsedBody: AdminUpdateUserBody,
) {
  const data: {
    isAdmin?: boolean;
    name?: string;
    username?: string | null;
  } = {};

  if ("name" in parsedBody) data.name = normalizeAdminUserName(parsedBody.name);

  if ("username" in parsedBody) {
    const username = normalizeAdminUsername(parsedBody.username);
    if (username) {
      if (!/^[a-z0-9-]{1,20}$/.test(username)) {
        return { ok: false as const, reason: "invalid_username" as const };
      }
      const existing = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existing && existing.id !== id) {
        return { ok: false as const, reason: "username_taken" as const };
      }
    }
    data.username = username;
  }

  if ("isAdmin" in parsedBody && typeof parsedBody.isAdmin === "boolean") {
    data.isAdmin = parsedBody.isAdmin;
  }

  return { data, ok: true as const };
}

function parseSuspensionDate(value: string | null | undefined) {
  const parsed = parseDateInput(value);
  if (parsed === undefined) {
    return { ok: false as const, reason: "invalid_expires_at" as const };
  }
  return { expiresAt: parsed, ok: true as const };
}

export async function updateAdminUser(
  id: string,
  parsedBody: AdminUpdateUserBody,
) {
  const parsed = await buildAdminUserUpdateData(id, parsedBody);
  if (!parsed.ok) return parsed;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existingUser) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true },
  });

  const user = await getAdminUserListItem(updated.id);
  if (!user) return { ok: false as const, reason: "not_found" as const };

  return {
    ok: true as const,
    user,
  };
}

export async function listAdminSuspensions() {
  return prisma.userSuspension.findMany({
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAdminSuspension(
  adminUserId: string,
  input: AdminCreateSuspensionInput,
) {
  const expiresAt = parseSuspensionDate(input.expiresAt);
  if (!expiresAt.ok) return expiresAt;

  const userId = input.userId.trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { ok: false as const, reason: "user_not_found" as const };

  const suspension = await prisma.userSuspension.create({
    data: {
      userId,
      createdById: adminUserId,
      reason: input.reason?.trim() || null,
      note: input.note?.trim() || null,
      expiresAt: expiresAt.expiresAt,
    },
  });

  fireAuditLog({
    action: "admin_user_suspend",
    userId: adminUserId,
    targetId: userId,
    targetType: "user",
    metadata: { reason: input.reason ?? null },
  });

  return { ok: true as const, suspension };
}

export async function liftAdminSuspension(adminUserId: string, id: string) {
  const existing = await prisma.userSuspension.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false as const, reason: "not_found" as const };

  const suspension = await prisma.userSuspension.update({
    where: { id },
    data: {
      liftedAt: new Date(),
      liftedById: adminUserId,
    },
  });

  fireAuditLog({
    action: "admin_user_unsuspend",
    userId: adminUserId,
    targetId: suspension.userId,
    targetType: "user",
    metadata: { suspensionId: id },
  });

  return { ok: true as const, suspension };
}

export async function moderateComment(
  adminUserId: string,
  id: string,
  input: AdminModerateCommentInput,
) {
  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false as const, reason: "not_found" as const };

  const { status, moderationNote } = input;
  const comment = await prisma.comment.update({
    where: { id },
    data: {
      status,
      moderationNote: moderationNote ?? null,
      moderatedAt: new Date(),
      moderatedById: adminUserId,
      deletedAt: status === "deleted" ? new Date() : null,
    },
  });

  fireAuditLog({
    action: "admin_comment_moderate",
    userId: adminUserId,
    targetId: id,
    targetType: "comment",
    metadata: { status, moderationNote: moderationNote ?? null },
  });

  return { comment, ok: true as const };
}
