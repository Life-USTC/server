import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export function isSerializationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as {
    cause?: unknown;
    code?: unknown;
    message?: unknown;
    name?: unknown;
  };
  if (candidate.code === "P2034") {
    return true;
  }

  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  if (
    candidate.name === "DriverAdapterError" &&
    message.includes("TransactionWriteConflict")
  ) {
    return true;
  }

  return isSerializationError(candidate.cause);
}

export async function runSerializableTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  failureMessage: string,
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(action, {
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
