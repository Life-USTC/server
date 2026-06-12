import { jsonResponse, notFound } from "@/lib/api/helpers";
import { fireAuditLog } from "@/lib/audit/write-audit-log";
import { parseDate } from "./admin-shared";

export async function listAdminSuspensionsAction() {
  const { prisma } = await import("@/lib/db/prisma");
  const suspensions = await prisma.userSuspension.findMany({
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonResponse({ suspensions });
}

export async function createAdminSuspensionAction(
  adminUserId: string,
  parsedBody: {
    expiresAt?: string | null;
    note?: string | null;
    reason?: string | null;
    userId: string;
  },
) {
  const userId = parsedBody.userId.trim();
  const { prisma } = await import("@/lib/db/prisma");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return notFound("User not found");

  const suspension = await prisma.userSuspension.create({
    data: {
      userId,
      createdById: adminUserId,
      reason: parsedBody.reason?.trim() || null,
      note: parsedBody.note?.trim() || null,
      expiresAt: parseDate(parsedBody.expiresAt ?? null),
    },
  });

  fireAuditLog({
    action: "admin_user_suspend",
    userId: adminUserId,
    targetId: userId,
    targetType: "user",
    metadata: { reason: parsedBody.reason ?? null },
  });

  return jsonResponse({ suspension });
}

export async function liftAdminSuspensionAction(
  adminUserId: string,
  id: string,
) {
  const { prisma } = await import("@/lib/db/prisma");
  const existing = await prisma.userSuspension.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return notFound();

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

  return jsonResponse({ suspension });
}
