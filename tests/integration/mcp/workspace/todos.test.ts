import { describe } from "vitest";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import type { TestPrismaClient } from "../../../shared/prisma";
import { isolatedMcpTest as toolTest } from "../_harness/isolated-context";

function seedTodo(db: TestPrismaClient, userId: string) {
  return db.todo.create({
    data: {
      userId,
      title: "[integration-test] original todo",
      content: "clear me through mcp",
      priority: "high",
      dueAt: new Date("2026-05-10T00:00:00.000Z"),
    },
  });
}

describe("todo CRUD — workspace_todo_update 返回更新后的实体", () => {
  toolTest(
    "workspace_todo_update 返回更新后的 todo 实体（不仅 success: true）",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const before = await seedTodo(db, isolated.userId);
        const foreign = await seedTodo(db, mcpOtherActor.userId);
        const result = await isolated.client.call<{
          success?: boolean;
          todo?: {
            id?: string;
            title?: string;
            priority?: string;
            completed?: boolean;
            updatedAt?: string;
          } | null;
        }>("workspace_todo_update", {
          id: before.id,
          title: "[integration-test] renamed",
          priority: "low",
          completed: true,
        });
        expect(result).toMatchObject({
          success: true,
          todo: {
            id: before.id,
            title: "[integration-test] renamed",
            priority: "low",
            completed: true,
          },
        });
        expect(result.todo?.updatedAt).toMatch(/\+08:00$/);
        const after = await db.todo.findUniqueOrThrow({
          where: { id: before.id },
        });
        expect(after).toEqual({
          ...before,
          title: "[integration-test] renamed",
          priority: "low",
          completed: true,
          updatedAt: expect.any(Date),
        });
        expect(new Date(result.todo?.updatedAt ?? "").getTime()).toBe(
          after.updatedAt.getTime(),
        );
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
        ).toEqual(foreign);
      }),
  );

  toolTest(
    "workspace_todo_update 校验规范化内容长度",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const before = await seedTodo(db, isolated.userId);
        const foreign = await seedTodo(db, mcpOtherActor.userId);
        const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);
        const result = await isolated.client.call<{
          success?: boolean;
          todo?: { id?: string; content?: string | null } | null;
        }>("workspace_todo_update", {
          id: before.id,
          content: ` ${content} `,
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          todo: { id: before.id, content },
        });
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: before.id } }),
        ).toEqual({
          ...before,
          content,
          updatedAt: expect.any(Date),
        });
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
        ).toEqual(foreign);
      }),
  );

  toolTest(
    "workspace_todo_update 在内容显式为 null 时清空内容",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const before = await seedTodo(db, isolated.userId);
        const foreign = await seedTodo(db, mcpOtherActor.userId);
        const result = await isolated.client.call<{
          success?: boolean;
          todo?: { id?: string; content?: string | null } | null;
        }>("workspace_todo_update", {
          id: before.id,
          content: null,
          mode: "full",
        });
        expect(result).toMatchObject({
          success: true,
          todo: { id: before.id, content: null },
        });
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: before.id } }),
        ).toEqual({
          ...before,
          content: null,
          updatedAt: expect.any(Date),
        });
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
        ).toEqual(foreign);
      }),
  );

  toolTest(
    "workspace_todo_delete 删除 todo",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const before = await seedTodo(db, isolated.userId);
        const foreign = await seedTodo(db, mcpOtherActor.userId);
        const result = await isolated.client.call<{ success?: boolean }>(
          "workspace_todo_delete",
          { id: before.id },
        );
        expect(result.success).toBe(true);
        expect(await db.todo.findMany()).toEqual([foreign]);
      }),
  );

  toolTest(
    "workspace_todo_create 返回新 todo id",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      mcpOtherActor,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const foreign = await seedTodo(db, mcpOtherActor.userId);
        const result = await isolated.client.call<{
          success?: boolean;
          id?: string;
        }>("workspace_todo_create", {
          title: "[integration-test] created todo",
          content: "created through mcp",
          priority: "high",
          dueAt: "2026-05-10",
        });
        expect(result.success).toBe(true);
        expect(result.id).toEqual(expect.any(String));
        expect(result.id).toBeTruthy();
        expect(
          await db.todo.findMany({ where: { userId: isolated.userId } }),
        ).toEqual([
          {
            id: result.id,
            userId: isolated.userId,
            title: "[integration-test] created todo",
            content: "created through mcp",
            priority: "high",
            completed: false,
            dueAt: new Date("2026-05-10T00:00:00.000Z"),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        ]);
        expect(
          await db.todo.findUniqueOrThrow({ where: { id: foreign.id } }),
        ).toEqual(foreign);
      }),
  );
});
