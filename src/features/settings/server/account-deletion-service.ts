import type { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/db/auth-prisma";
import { withUserDbContext } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/serializable-transaction";

type DeleteOwnAccountResult =
  | { ok: true }
  | { ok: false; reason: "cannot_remove_last_admin" | "not_found" };

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

  if (!gate.ok) return gate;

  await withUserDbContext(userId, (tx) =>
    deleteRlsProtectedUserData(tx, userId),
  );

  return runSerializableTransaction(
    async (tx) => {
      await tx.user.delete({ where: { id: userId } });
      return { ok: true as const };
    },
    "Failed to delete account",
    authPrisma,
  );
}
