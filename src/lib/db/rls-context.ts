import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@/generated/prisma/client";
import { elapsedMs, monotonicNowMs } from "@/lib/log/observability-clock";
import { recordWorkspaceRouteDbContext } from "@/lib/log/workspace-route-attribution";

type UserRlsContext = {
  locale?: string;
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

export function getUserRlsContextLocale() {
  return userRlsStorage.getStore()?.locale;
}

export async function runWithUserRlsContext<T>(
  client: TransactionStarter,
  userId: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  locale?: string,
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("RLS user ID is required");

  const active = userRlsStorage.getStore();
  if (active) {
    if (active.userId !== normalizedUserId) {
      throw new Error("Cannot change RLS user inside an active transaction");
    }
    if (locale !== undefined && active.locale !== locale) {
      throw new Error("Cannot change locale inside an active RLS transaction");
    }
    return action(active.tx);
  }

  const transactionStartMs = monotonicNowMs();
  return client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${normalizedUserId}, true)`;
    recordWorkspaceRouteDbContext(elapsedMs(transactionStartMs));
    return userRlsStorage.run({ locale, tx, userId: normalizedUserId }, () =>
      action(tx),
    );
  });
}
