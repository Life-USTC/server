import { describe, expect } from "vitest";
import { prisma, withUserDbContext } from "@/lib/db/prisma";
import { rlsTest as it } from "../shared/rls-fixture";

describe.skipIf(process.env.RLS_TEST_ENABLED !== "true")(
  "Todo PostgreSQL row security",
  () => {
    it("defaults to no rows when user context is missing", async ({
      rlsRuntime,
      rlsActors: { firstUserId },
    }) => {
      await rlsRuntime.run(async () => {
        const title = `[rls-test] missing context ${crypto.randomUUID()}`;
        const created = await withUserDbContext(firstUserId, (tx) =>
          tx.todo.create({
            data: { title, userId: firstUserId },
            select: { id: true },
          }),
        );

        try {
          await expect(
            withUserDbContext(firstUserId, (tx) =>
              tx.todo.findUnique({
                where: { id: created.id },
                select: { id: true, userId: true },
              }),
            ),
          ).resolves.toEqual({ id: created.id, userId: firstUserId });
          await expect(
            prisma.todo.findMany({ where: { id: created.id } }),
          ).resolves.toEqual([]);
          await expect(
            prisma.todo.updateMany({
              where: { id: created.id },
              data: { completed: true },
            }),
          ).resolves.toEqual({ count: 0 });
          await expect(
            prisma.todo.deleteMany({ where: { id: created.id } }),
          ).resolves.toEqual({ count: 0 });
          await expect(
            prisma.todo.create({
              data: { title: `${title} direct`, userId: firstUserId },
            }),
          ).rejects.toThrow();
        } finally {
          await withUserDbContext(firstUserId, (tx) =>
            tx.todo.deleteMany({ where: { title: { startsWith: title } } }),
          );
        }
      });
    });
    it("rolls back a failed action and returns the pooled client to fail-closed state", async ({
      rlsRuntime,
      rlsActors: { firstUserId },
    }) => {
      await rlsRuntime.run(async () => {
        const title = "[rls-test] rolled back action";
        await expect(
          withUserDbContext(firstUserId, async (tx) => {
            await tx.todo.create({
              data: { title, userId: firstUserId },
            });
            throw new Error("force transaction rollback");
          }),
        ).rejects.toThrow("force transaction rollback");

        await expect(
          prisma.todo.findMany({ where: { title } }),
        ).resolves.toEqual([]);
        await expect(
          prisma.todo.create({
            data: { title: "[rls-test] context leaked", userId: firstUserId },
          }),
        ).rejects.toThrow();
      });
    });
    it("isolates concurrent users and rejects forged ownership", async ({
      rlsRuntime,
      rlsActors: { firstUserId, secondUserId, adminUserId },
    }) => {
      await rlsRuntime.run(async () => {
        const first = await withUserDbContext(firstUserId, () =>
          prisma.todo.create({
            data: { title: "[rls-test] first", userId: firstUserId },
            select: { id: true },
          }),
        );
        const second = await withUserDbContext(secondUserId, () =>
          prisma.todo.create({
            data: { title: "[rls-test] second", userId: secondUserId },
            select: { id: true },
          }),
        );
        const createdIds = [first.id, second.id];

        const [firstRows, secondRows, adminRows] = await Promise.all([
          withUserDbContext(firstUserId, () =>
            prisma.todo.findMany({ select: { id: true } }),
          ),
          withUserDbContext(secondUserId, () =>
            prisma.todo.findMany({ select: { id: true } }),
          ),
          withUserDbContext(adminUserId, (tx) =>
            tx.todo.findMany({
              where: { id: { in: [first.id, second.id] } },
              select: { id: true },
            }),
          ),
        ]);
        expect(firstRows).toContainEqual({ id: first.id });
        expect(firstRows).not.toContainEqual({ id: second.id });
        expect(secondRows).toContainEqual({ id: second.id });
        expect(secondRows).not.toContainEqual({ id: first.id });
        expect(adminRows).toEqual([]);

        await expect(
          withUserDbContext(secondUserId, () =>
            prisma.todo.create({
              data: { title: "[rls-test] forged", userId: firstUserId },
            }),
          ),
        ).rejects.toThrow();

        await expect(
          prisma.todo.findMany({ where: { id: { in: createdIds } } }),
        ).resolves.toEqual([]);

        await expect(
          withUserDbContext(secondUserId, () =>
            prisma.todo.update({
              where: { id: first.id },
              data: { title: "[rls-test] cross-owner update" },
            }),
          ),
        ).rejects.toThrow();
        await expect(
          withUserDbContext(secondUserId, () =>
            prisma.todo.delete({ where: { id: first.id } }),
          ),
        ).rejects.toThrow();
        await expect(
          withUserDbContext(secondUserId, () =>
            prisma.todo.updateMany({
              where: { id: first.id },
              data: { completed: true },
            }),
          ),
        ).resolves.toEqual({ count: 0 });
        await expect(
          withUserDbContext(secondUserId, () =>
            prisma.todo.deleteMany({ where: { id: first.id } }),
          ),
        ).resolves.toEqual({ count: 0 });
        await expect(
          withUserDbContext(firstUserId, () =>
            prisma.todo.update({
              where: { id: first.id },
              data: { userId: secondUserId },
            }),
          ),
        ).rejects.toThrow();

        await expect(
          withUserDbContext(firstUserId, () =>
            prisma.todo.findUnique({
              where: { id: first.id },
              select: { userId: true, completed: true },
            }),
          ),
        ).resolves.toEqual({ userId: firstUserId, completed: false });
      });
    });
  },
);
