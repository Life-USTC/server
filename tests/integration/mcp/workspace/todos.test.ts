import { describe, expect, it } from "vitest";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import {
  assertTodoCreateSuccess,
  assertTodoUpdateEcho,
} from "../../../shared/scenarios/todo-crud";
import * as fixtures from "../_harness";

const isolated = fixtures.createSubscribedIsolatedMcpToolTestContext({
  emailPrefix: "mcp-todos-homeworks",
  name: "[integration-test] Todos Homeworks",
});

describe("todo CRUD — workspace_todo_update 返回更新后的实体", () => {
  async function createIntegrationTodo(testName: string) {
    const result = await isolated.client.call<{
      success?: boolean;
      id?: string;
    }>("workspace_todo_create", {
      title: `[integration-test] ${testName} ${Date.now()}`,
      content: "clear me through mcp",
      priority: "high",
      dueAt: fixtures.SEED_PLUS_ELEVEN_DAYS,
    });
    assertTodoCreateSuccess(result);
    return result.id;
  }

  it("workspace_todo_update 返回更新后的 todo 实体（不仅 success: true）", async () => {
    const todoId = await createIntegrationTodo("update returns todo");
    try {
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
    } finally {
      await fixtures.deleteIntegrationTodo(todoId);
    }
  });

  it("workspace_todo_update 校验规范化内容长度", async () => {
    const todoId = await createIntegrationTodo("normalized content");
    const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);
    try {
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
    } finally {
      await fixtures.deleteIntegrationTodo(todoId);
    }
  });

  it("workspace_todo_update 在内容显式为 null 时清空内容", async () => {
    const todoId = await createIntegrationTodo("clear content");
    try {
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
    } finally {
      await fixtures.deleteIntegrationTodo(todoId);
    }
  });

  it("workspace_todo_delete 删除 todo", async () => {
    const todoId = await createIntegrationTodo("delete");
    try {
      const result = await isolated.client.call<{ success?: boolean }>(
        "workspace_todo_delete",
        {
          id: todoId,
        },
      );
      expect(result.success).toBe(true);

      const remaining = await fixtures.prisma.todo.findUnique({
        where: { id: todoId },
        select: { id: true },
      });
      expect(remaining).toBeNull();
    } finally {
      await fixtures.deleteIntegrationTodo(todoId);
    }
  });

  it("workspace_todo_create 返回新 todo id", async () => {
    const todoId = await createIntegrationTodo("create");
    try {
      const created = await fixtures.prisma.todo.findUnique({
        where: { id: todoId },
        select: { id: true, title: true },
      });
      expect(created).toMatchObject({
        id: todoId,
      });
    } finally {
      await fixtures.deleteIntegrationTodo(todoId);
    }
  });
});

describe("作业写入工具 — MCP 镜像普通用户 REST 写入", () => {
  it("community_section_homework_delete 删除创建者拥有的作业并记录审计", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    expect(section?.id).toBeTypeOf("number");
    if (!section) throw new Error("Expected seeded section");

    const homework = await fixtures.prisma.homework.create({
      data: {
        sectionId: section.id,
        title: `[integration-test] mcp-homework-delete-${Date.now()}`,
        createdById: isolated.userId,
        updatedById: isolated.userId,
      },
      select: { id: true },
    });

    try {
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

      const record = await fixtures.prisma.homework.findUnique({
        where: { id: homework.id },
        select: { deletedAt: true, deletedById: true },
      });
      expect(record?.deletedAt).toBeInstanceOf(Date);
      expect(record?.deletedById).toBe(isolated.userId);

      const audit = await fixtures.prisma.auditLog.findFirst({
        where: {
          targetId: homework.id,
          action: "homework_delete",
          userId: isolated.userId,
          channel: "mcp",
        },
      });
      expect(audit?.id).toBeTypeOf("string");
    } finally {
      await fixtures.deleteIntegrationHomework(homework.id);
    }
  });

  it("community_section_homework_delete 序列化未找到及非所有者失败", async () => {
    const section = await fixtures.prisma.section.findUnique({
      where: { jwId: fixtures.DEV_SEED.section.jwId },
      select: { id: true },
    });
    expect(section?.id).toBeTypeOf("number");
    if (!section) throw new Error("Expected seeded section");

    const otherUser = await fixtures.prisma.user.create({
      data: {
        email: fixtures.integrationUserEmail("mcp-homework-owner"),
        name: "MCP Homework Owner",
      },
      select: { id: true },
    });
    const homework = await fixtures.prisma.homework.create({
      data: {
        sectionId: section.id,
        title: `[integration-test] mcp-homework-non-owner-${Date.now()}`,
        createdById: otherUser.id,
        updatedById: otherUser.id,
      },
      select: { id: true },
    });

    try {
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
    } finally {
      await fixtures.deleteIntegrationHomework(homework.id);
      await fixtures.prisma.user.deleteMany({ where: { id: otherUser.id } });
    }
  });
});
