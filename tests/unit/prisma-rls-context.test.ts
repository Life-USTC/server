import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";

const { baseClient, extendedClient, todoFindManyMock } = vi.hoisted(() => {
  const todoFindMany = vi.fn().mockResolvedValue([]);
  const extended = {
    kind: "localized",
    todo: { findMany: todoFindMany },
  };
  return {
    baseClient: {
      $extends: vi.fn(() => extended),
    },
    extendedClient: extended,
    todoFindManyMock: todoFindMany,
  };
});

vi.mock("@/lib/db/prisma-query-events", () => ({
  createBasePrisma: vi.fn(() => baseClient),
  logPrismaQuery: vi.fn(),
}));

vi.mock("@/lib/db/prisma-query-logging", () => ({
  shouldEnablePrismaQueryLogging: vi.fn(() => false),
}));

describe("localized Prisma clients in RLS context", () => {
  it("fails closed for both cold and prewarmed localized clients", async () => {
    const { getPrisma } = await import("@/lib/db/prisma");
    const { runWithUserRlsContext } = await import("@/lib/db/rls-context");
    const tx = { $queryRaw: vi.fn() } as unknown as Prisma.TransactionClient;
    const client = {
      $transaction: vi.fn(async (action) => action(tx)),
    };

    await runWithUserRlsContext(client, "user-1", async () => {
      expect(() => getPrisma("en-us")).toThrow(
        "Localized Prisma clients cannot be used inside an RLS context",
      );
    });

    expect(getPrisma("zh-cn")).toHaveProperty("kind", extendedClient.kind);
    await runWithUserRlsContext(client, "user-1", async () => {
      expect(() => getPrisma("zh-cn")).toThrow(
        "Localized Prisma clients cannot be used inside an RLS context",
      );
    });
  });

  it("fails closed for a prewarmed Cloudflare request cache", async () => {
    const { runWithCloudflareRuntimeEnv } = await import(
      "@/lib/adapters/cloudflare-runtime"
    );
    const { getPrisma } = await import("@/lib/db/prisma");
    const { runWithUserRlsContext } = await import("@/lib/db/rls-context");
    const tx = { $queryRaw: vi.fn() } as unknown as Prisma.TransactionClient;
    const client = {
      $transaction: vi.fn(async (action) => action(tx)),
    };

    await runWithCloudflareRuntimeEnv({}, async () => {
      expect(getPrisma("cf-en-us")).toHaveProperty("kind", extendedClient.kind);
      await runWithUserRlsContext(client, "user-1", async () => {
        expect(() => getPrisma("cf-en-us")).toThrow(
          "Localized Prisma clients cannot be used inside an RLS context",
        );
      });
    });
  });

  it("blocks saved localized clients, delegates, and methods inside RLS context", async () => {
    const { getPrisma } = await import("@/lib/db/prisma");
    const { runWithUserRlsContext } = await import("@/lib/db/rls-context");
    const tx = { $queryRaw: vi.fn() } as unknown as Prisma.TransactionClient;
    const client = {
      $transaction: vi.fn(async (action) => action(tx)),
    };
    const localized = getPrisma("saved-client");
    const todo = localized.todo;
    const findMany = todo.findMany;

    await runWithUserRlsContext(client, "user-1", async () => {
      expect(() => localized.todo).toThrow(
        "Localized Prisma clients cannot be used inside an RLS context",
      );
      expect(() => todo.findMany).toThrow(
        "Localized Prisma clients cannot be used inside an RLS context",
      );
      expect(() => findMany()).toThrow(
        "Localized Prisma clients cannot be used inside an RLS context",
      );
    });
    expect(todoFindManyMock).not.toHaveBeenCalled();
  });
});
