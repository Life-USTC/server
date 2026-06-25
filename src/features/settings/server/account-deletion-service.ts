import { runSerializableTransaction } from "@/lib/db/serializable-transaction";

type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; reason: "cannot_remove_last_admin" | "not_found" };

export async function deleteOwnAccount(
  userId: string,
): Promise<DeleteOwnAccountResult> {
  return runSerializableTransaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, isAdmin: true },
    });
    if (!user) return { ok: false, reason: "not_found" };

    if (user.isAdmin) {
      const adminCount = await tx.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) {
        return { ok: false, reason: "cannot_remove_last_admin" };
      }
    }

    await tx.auditLog.updateMany({
      where: { userId },
      data: { userId: null },
    });
    await tx.userSuspension.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });
    await tx.userSuspension.updateMany({
      where: { liftedById: userId },
      data: { liftedById: null },
    });
    await tx.user.delete({ where: { id: userId } });

    return { ok: true };
  }, "Failed to delete account");
}
