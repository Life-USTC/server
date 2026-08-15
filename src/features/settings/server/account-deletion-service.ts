import type { Prisma } from "@/generated/prisma/client";
import { type AuditLogParams, fireAuditLog } from "@/lib/audit/write-audit-log";
import { authPrisma } from "@/lib/db/auth-prisma";
import { withUserDbContext } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/serializable-transaction";

type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; reason: "cannot_remove_last_admin" | "not_found" };

export type AccountDeletionAuditContext = Pick<
  AuditLogParams,
  "channel" | "ipAddress" | "requestId" | "sessionId" | "userAgent"
>;

async function deleteRlsProtectedUserData(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.commentReaction.deleteMany({ where: { userId } });
  await tx.homeworkCompletion.deleteMany({ where: { userId } });
  await tx.uploadPending.deleteMany({ where: { userId } });
  await tx.upload.deleteMany({ where: { userId } });
  await tx.dashboardLinkClick.deleteMany({ where: { userId } });
  await tx.dashboardLinkPin.deleteMany({ where: { userId } });
  await tx.busUserPreference.deleteMany({ where: { userId } });
  await tx.todo.deleteMany({ where: { userId } });
}

export async function deleteOwnAccount(
  userId: string,
  audit: AccountDeletionAuditContext,
): Promise<DeleteOwnAccountResult> {
  userId = userId.trim();
  if (!userId) throw new Error("Account deletion user ID is required");

  const gate = await runSerializableTransaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isAdmin: true },
      });
      if (!user) return { ok: false as const, reason: "not_found" as const };

      if (user.isAdmin) {
        const adminCount = await tx.user.count({ where: { isAdmin: true } });
        if (adminCount <= 1) {
          return {
            ok: false as const,
            reason: "cannot_remove_last_admin" as const,
          };
        }
      }

      return { ok: true as const };
    },
    "Failed to delete account",
    authPrisma,
  );

  if (!gate.ok) {
    await fireAuditLog({
      action: "account_delete",
      outcome: "denied",
      targetId: userId,
      targetType: "user",
      ...(gate.reason === "cannot_remove_last_admin"
        ? { subjectUserId: userId, userId }
        : {}),
      metadata: { reason: gate.reason, selfService: true },
      ...audit,
    });
    return gate;
  }

  await withUserDbContext(userId, (tx) =>
    deleteRlsProtectedUserData(tx, userId),
  );

  try {
    const result = await runSerializableTransaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT public.anonymize_deleted_account_audit_targets(${userId})
        `;
        await tx.user.delete({ where: { id: userId } });
        return { ok: true as const };
      },
      "Failed to delete account",
      authPrisma,
    );
    await fireAuditLog({
      action: "account_delete",
      targetType: "user",
      metadata: { selfService: true },
      ...audit,
    });
    return result;
  } catch (error) {
    await fireAuditLog({
      action: "account_delete",
      outcome: "failure",
      subjectUserId: userId,
      targetId: userId,
      targetType: "user",
      userId,
      metadata: { selfService: true },
      ...audit,
    });
    throw error;
  }
}
