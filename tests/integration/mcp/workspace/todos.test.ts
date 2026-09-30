import { describe } from "vitest";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import {
  assertTodoCreateSuccess,
  assertTodoUpdateEcho,
} from "../../../shared/scenarios/todo-crud";
import {
  type PrivateMcpActor,
  isolatedMcpTest as toolTest,
} from "../_harness/isolated-context";

describe("todo CRUD — workspace_todo_update 返回更新后的实体", () => {
  async function createIntegrationTodo(
    isolated: PrivateMcpActor,
    testName: string,
  ) {
    const result = await isolated.client.call<{
      success?: boolean;
      id?: string;
    }>("workspace_todo_create", {
      title: `[integration-test] ${testName} ${Date.now()}`,
      content: "clear me through mcp",
      priority: "high",
      dueAt: "2026-05-10",
    });
    assertTodoCreateSuccess(result);
    return result.id;
  }

  toolTest(
    "workspace_todo_update 返回更新后的 todo 实体（不仅 success: true）",
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const todoId = await createIntegrationTodo(
          isolated,
          "update returns todo",
        );

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
          id: todoId,
          title: "[integration-test] renamed",
          priority: "low",
          completed: true,
        });

        assertTodoUpdateEcho(result, {
          id: todoId,
          title: "[integration-test] renamed",
          priority: "low",
          completed: true,
        });
        // updatedAt should be a valid Shanghai-offset datetime
        expect(result.todo?.updatedAt).toMatch(/\+08:00$/);
      }),
  );

  toolTest(
    "workspace_todo_update 校验规范化内容长度",
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const todoId = await createIntegrationTodo(
          isolated,
          "normalized content",
        );
        const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);

        const result = await isolated.client.call<{
          success?: boolean;
          todo?: {
            id?: string;
            content?: string | null;
          } | null;
        }>("workspace_todo_update", {
          id: todoId,
          content: ` ${content} `,
          mode: "full",
        });

        expect(result.success).toBe(true);
        expect(result.todo?.id).toBe(todoId);
        expect(result.todo?.content).toBe(content);
      }),
  );

  toolTest(
    "workspace_todo_update 在内容显式为 null 时清空内容",
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const todoId = await createIntegrationTodo(isolated, "clear content");

        const result = await isolated.client.call<{
          success?: boolean;
          todo?: {
            id?: string;
            content?: string | null;
          } | null;
        }>("workspace_todo_update", {
          id: todoId,
          content: null,
          mode: "full",
        });

        expect(result.success).toBe(true);
        expect(result.todo?.id).toBe(todoId);
        expect(result.todo?.content).toBeNull();
      }),
  );

  toolTest(
    "workspace_todo_delete 删除 todo",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const todoId = await createIntegrationTodo(isolated, "delete");

        const result = await isolated.client.call<{ success?: boolean }>(
          "workspace_todo_delete",
          {
            id: todoId,
          },
        );
        expect(result.success).toBe(true);

        const remaining = await db.todo.findUnique({
          where: { id: todoId },
          select: { id: true },
        });
        expect(remaining).toBeNull();
      }),
  );

  toolTest(
    "workspace_todo_create 返回新 todo id",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
    }) =>
      mcpWorkflow.run(async () => {
        const todoId = await createIntegrationTodo(isolated, "create");

        const created = await db.todo.findUnique({
          where: { id: todoId },
          select: { id: true, title: true },
        });
        expect(created).toMatchObject({
          id: todoId,
        });
      }),
  );
});

describe("作业写入工具 — MCP 镜像普通用户 REST 写入", () => {
  toolTest(
    "community_section_homework_delete 删除创建者拥有的作业并记录审计",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSection,
    }) =>
      mcpWorkflow.run(async () => {
        const section = await db.section.findUnique({
          where: { jwId: mcpSection.jwId },
          select: { id: true },
        });
        expect(section?.id).toBeTypeOf("number");
        if (!section) throw new Error("Expected private section");

        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            title: `[integration-test] mcp-homework-delete-${Date.now()}`,
            createdById: isolated.userId,
            updatedById: isolated.userId,
          },
          select: { id: true },
        });

        const deleted = await isolated.client.call<{
          alreadyDeleted?: boolean;
          deletedId?: string;
          success?: boolean;
        }>("community_section_homework_delete", {
          homeworkId: homework.id,
        });
        expect(deleted).toEqual({
          success: true,
          deletedId: homework.id,
          alreadyDeleted: false,
        });

        const record = await db.homework.findUnique({
          where: { id: homework.id },
          select: { deletedAt: true, deletedById: true },
        });
        expect(record?.deletedAt).toBeInstanceOf(Date);
        expect(record?.deletedById).toBe(isolated.userId);

        const audit = await db.auditLog.findFirst({
          where: {
            targetId: homework.id,
            action: "homework_delete",
            userId: isolated.userId,
            channel: "mcp",
          },
        });
        expect(audit?.id).toBeTypeOf("string");
      }),
  );

  toolTest(
    "community_section_homework_delete 序列化未找到及非所有者失败",
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      expect,
      isolatedDatabase: { owner: db },
      mcpSection,
      mcpSessions,
    }) =>
      mcpWorkflow.run(async () => {
        const section = await db.section.findUnique({
          where: { jwId: mcpSection.jwId },
          select: { id: true },
        });
        expect(section?.id).toBeTypeOf("number");
        if (!section) throw new Error("Expected private section");

        const otherUser = await db.user.create({
          data: {
            email: "mcp-homework-owner@example.test",
            name: "MCP Homework Owner",
          },
          select: { id: true },
        });
        const homework = await db.homework.create({
          data: {
            sectionId: section.id,
            title: `[integration-test] mcp-homework-non-owner-${Date.now()}`,
            createdById: otherUser.id,
            updatedById: otherUser.id,
          },
          select: { id: true },
        });

        const notFound = await isolated.client.call<{
          error?: string;
          success?: boolean;
        }>("community_section_homework_delete", {
          homeworkId: "missing-homework-id",
        });
        expect(notFound).toMatchObject({
          success: false,
          error: "not_found",
        });

        const forbidden = await isolated.client.call<{
          error?: string;
          success?: boolean;
        }>("community_section_homework_delete", {
          homeworkId: homework.id,
        });
        expect(forbidden).toMatchObject({
          success: false,
          error: "forbidden",
        });
        await db.user.update({
          where: { id: isolated.userId },
          data: { isAdmin: true },
        });
        const adminSession = mcpSessions.own(isolated.userId, [
          "community.section-homework:write",
        ]);
        await adminSession.initialize();
        const adminClient = adminSession.client;

        await expect(
          adminClient.call("community_section_homework_delete", {
            homeworkId: homework.id,
          }),
        ).resolves.toMatchObject({ success: false, error: "forbidden" });
        await expect(
          db.homework.findUniqueOrThrow({
            where: { id: homework.id },
            select: { deletedAt: true },
          }),
        ).resolves.toEqual({ deletedAt: null });
      }),
  );
});
