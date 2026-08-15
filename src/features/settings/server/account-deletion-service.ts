import { type AuditLogParams, fireAuditLog } from "@/lib/audit/write-audit-log";
import { authPrisma } from "@/lib/db/auth-prisma";
import { runSerializableTransaction } from "@/lib/db/serializable-transaction";

type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; reason: "cannot_remove_last_admin" | "not_found" };

export type AccountDeletionAuditContext = Pick<
  AuditLogParams,
  "channel" | "ipAddress" | "requestId" | "sessionId" | "userAgent"
>;

export async function deleteOwnAccount(
  userId: string,
  audit: AccountDeletionAuditContext,
): Promise<DeleteOwnAccountResult> {
  userId = userId.trim();
  if (!userId) throw new Error("Account deletion user ID is required");

  try {
    const auditId = crypto.randomUUID();
    const [row] = await runSerializableTransaction(
      (tx) =>
        tx.$queryRaw<
          Array<{
            status: "cannot_remove_last_admin" | "deleted" | "not_found";
          }>
        >`SELECT public.delete_own_account(
          ${userId},
          ${auditId},
          ${audit.channel ?? "web"},
          ${audit.ipAddress ?? null},
          ${audit.userAgent ?? null},
          ${audit.sessionId ?? null},
          ${audit.requestId ?? null}
        ) AS status`,
      "Failed to delete account",
      authPrisma,
    );
    if (
      !row ||
      row.status === "not_found" ||
      row.status === "cannot_remove_last_admin"
    ) {
      const reason: "cannot_remove_last_admin" | "not_found" =
        row?.status === "cannot_remove_last_admin"
          ? "cannot_remove_last_admin"
          : "not_found";
      const result = {
        ok: false as const,
        reason,
      };
      if (result.reason === "not_found") {
        await fireAuditLog({
          action: "account_delete",
          outcome: "denied",
          targetType: "user",
          metadata: { reason: result.reason, selfService: true },
          ...audit,
        });
      }
      return result;
    }
    return { ok: true };
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
