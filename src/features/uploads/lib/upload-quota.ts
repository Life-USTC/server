import type { Prisma } from "@/generated/prisma/client";

export class UploadError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

function isSerializationError(error: unknown): boolean {
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

export async function runUploadSerializableTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  failureMessage: string,
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
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
