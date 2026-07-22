import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@/generated/prisma/client";

type UserRlsContext = {
  tx: Prisma.TransactionClient;
  userId: string;
};

type TransactionStarter = {
  $transaction<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

const userRlsStorage = new AsyncLocalStorage<UserRlsContext>();

export function getUserRlsTransactionClient() {
  return userRlsStorage.getStore()?.tx;
}

export async function runWithUserRlsContext<T>(
  client: TransactionStarter,
  userId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("RLS user ID is required");

  const active = userRlsStorage.getStore();
  if (active) {
    if (active.userId !== normalizedUserId) {
      throw new Error("Cannot change RLS user inside an active transaction");
    }
    return action(active.tx);
  }

  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${normalizedUserId}, true)`;
    return userRlsStorage.run({ tx, userId: normalizedUserId }, () =>
      action(tx),
    );
  });
}
