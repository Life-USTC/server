import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import {
  getUserRlsTransactionClient,
  runWithUserRlsContext,
} from "@/lib/db/rls-context";

function createClient() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as unknown as Prisma.TransactionClient;
  const client = {
    $transaction: vi.fn(async (action) => action(tx)),
  };
  return { client, tx };
}

describe("user RLS context", () => {
  it("sets transaction-local identity and exposes the same client", async () => {
    const { client, tx } = createClient();
    const result = await runWithUserRlsContext(
      client,
      " user-1 ",
      async (current) => {
        expect(current).toBe(tx);
        expect(getUserRlsTransactionClient()).toBe(tx);
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledOnce();
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
    expect(getUserRlsTransactionClient()).toBeUndefined();
  });

  it("reuses a same-user context without nesting a transaction", async () => {
    const { client } = createClient();
    await runWithUserRlsContext(client, "user-1", async () => {
      await runWithUserRlsContext(client, "user-1", async () => undefined);
    });
    expect(client.$transaction).toHaveBeenCalledOnce();
  });

  it("rejects identity changes inside an active transaction", async () => {
    const { client } = createClient();
    await expect(
      runWithUserRlsContext(client, "user-1", () =>
        runWithUserRlsContext(client, "user-2", async () => undefined),
      ),
    ).rejects.toThrow("Cannot change RLS user");
  });
});
