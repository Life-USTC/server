import type { Prisma } from "@/generated/prisma/client";
import { runSerializableTransaction } from "@/lib/db/serializable-transaction";

export class UploadError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export async function runUploadSerializableTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  failureMessage: string,
) {
  return runSerializableTransaction(action, failureMessage);
}
