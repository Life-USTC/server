import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type SerializableTransactionClient = Pick<typeof prisma, "$transaction">;

function ownData(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function isDriverWriteConflict(error: unknown, requirePostgresCode: boolean) {
  if (ownData(error, "name") !== "DriverAdapterError") return false;
  const cause = ownData(error, "cause");
  if (ownData(cause, "kind") !== "TransactionWriteConflict") return false;
  const code = ownData(cause, "originalCode");
  return !requirePostgresCode || code === "40001" || code === "40P01";
}

export function isSerializationError(error: unknown): boolean {
  const seen = new Set<object>();
  let current = error;
  for (let depth = 0; depth < 64; depth += 1) {
    if (typeof current !== "object" || current === null || seen.has(current))
      return false;
    seen.add(current);
    const code = ownData(current, "code");
    if (code === "P2034" || isDriverWriteConflict(current, false)) return true;
    if (
      code === "P2010" &&
      isDriverWriteConflict(
        ownData(ownData(current, "meta"), "driverAdapterError"),
        true,
      )
    )
      return true;
    current = ownData(current, "cause");
  }
  return false;
}

export async function runSerializableTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  failureMessage: string,
  client: SerializableTransactionClient = prisma,
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.$transaction(action, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      if (isSerializationError(error) && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(failureMessage);
}
