import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { removeSignInMethod } from "./sign-in-methods";

function isOAuthRefreshTokenLookup(input: {
  model: string;
  where: Array<{ field: string; operator?: string }>;
}) {
  return (
    input.model.toLowerCase() === "oauthrefreshtoken" &&
    input.where.some(
      (condition) =>
        condition.field === "token" &&
        (!condition.operator || condition.operator === "eq"),
    )
  );
}

export function createBetterAuthPrismaAdapter(prisma: PrismaClient) {
  const createAdapter = prismaAdapter(prisma, {
    provider: "postgresql",
    transaction: true,
  });
  return (options: Parameters<typeof createAdapter>[0]) => {
    const adapter = createAdapter(options);
    const transaction: typeof adapter.transaction = (callback) =>
      prisma.$transaction((client) => {
        const transactionAdapter = prismaAdapter(client, {
          provider: "postgresql",
          transaction: false,
        })(options);
        return callback(wrapAuthAdapter(transactionAdapter, client));
      });
    return { ...wrapAuthAdapter(adapter, prisma), transaction };
  };
}

type AuthAdapter = ReturnType<ReturnType<typeof prismaAdapter>>;
function wrapAuthAdapter<T extends Pick<AuthAdapter, "findOne" | "delete">>(
  adapter: T,
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
): T {
  const findOne: typeof adapter.findOne = async <T>(
    input: Parameters<typeof adapter.findOne>[0],
  ): Promise<T | null> => {
    const row = await adapter.findOne<T>(input);
    // Better Auth 1.6 invalidates a reused token by client/user, which can
    // delete a newer authorization generation. The token route performs the
    // required cleanup itself using immutable grant-lineage evidence.
    if (
      row &&
      typeof row === "object" &&
      "revoked" in row &&
      row.revoked != null &&
      isOAuthRefreshTokenLookup(input)
    ) {
      return null;
    }
    return row;
  };
  const remove: typeof adapter.delete = async (input) => {
    const model = input.model.toLowerCase();
    if (model !== "account" && model !== "passkey")
      return adapter.delete(input);
    const row = await adapter.findOne<{ id: string; userId: string }>(input);
    if (!row) return;
    const result = await removeSignInMethod(client, row.userId, model, row.id);
    if (result === "last_account") {
      throw new APIError("BAD_REQUEST", {
        code: "FAILED_TO_UNLINK_LAST_ACCOUNT",
        message: "Cannot remove the last usable sign-in method",
      });
    }
  };
  return {
    ...adapter,
    findOne,
    delete: remove,
  };
}
