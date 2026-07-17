import type { Prisma } from "../generated/prisma-node/client";

export async function acquireStaticImportLock(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const [result] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
    SELECT pg_try_advisory_xact_lock(
      hashtext('life-ustc'),
      hashtext('static-loader')
    ) AS acquired
  `;
  if (!result?.acquired) {
    throw new Error("Another static import is already running");
  }
}
