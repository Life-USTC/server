import { describe, expect, it } from "vitest";
import { TODO_CONTENT_MAX_LENGTH } from "@/features/todos/lib/todo-limits";
import * as fixtures from "./utils/mcp-tool-test-utils";

const context = fixtures.createMcpToolTestContext();

describe("todo CRUD — update_my_todo returns updated entity", () => {
  async function createIntegrationTodo(testName: string) {
    const result = await context.client.call<{
      success?: boolean;
      id?: string;
    }>("create_my_todo", {
      title: `[integration-test] ${testName} ${Date.now()}`,
      content: "clear me through mcp",
      priority: "high",
      dueAt: fixtures.SEED_PLUS_ELEVEN_DAYS,
    });
    expect(result.success).toBe(true);
    expect(typeof result.id).toBe("string");
    return result.id as string;
  }

  async function deleteIntegrationTodo(todoId: string | undefined) {
    if (!todoId) return;
    await fixtures.prisma.todo.deleteMany({ where: { id: todoId } });
  }

  it("update_my_todo returns the updated todo entity (not just success: true)", async () => {
    const todoId = await createIntegrationTodo("update returns todo");
    try {
      const result = await context.client.call<{
        success?: boolean;
        todo?: {
          id?: string;
          title?: string;
          priority?: string;
          completed?: boolean;
          updatedAt?: string;
        } | null;
      }>("update_my_todo", {
        id: todoId,
        title: "[integration-test] renamed",
        priority: "low",
        completed: true,
      });

      expect(result.success).toBe(true);
      // The updated entity must be echoed — callers must not need a second read.
      expect(result.todo).not.toBeNull();
      expect(result.todo?.id).toBe(todoId);
      expect(result.todo?.title).toBe("[integration-test] renamed");
      expect(result.todo?.priority).toBe("low");
      expect(result.todo?.completed).toBe(true);
      // updatedAt should be a valid Shanghai-offset datetime
      expect(result.todo?.updatedAt).toMatch(/\+08:00$/);
    } finally {
      await deleteIntegrationTodo(todoId);
    }
  });

  it("update_my_todo validates normalized content length", async () => {
    const todoId = await createIntegrationTodo("normalized content");
    const content = "x".repeat(TODO_CONTENT_MAX_LENGTH);
    try {
      const result = await context.client.call<{
        success?: boolean;
        todo?: {
          id?: string;
          content?: string | null;
        } | null;
      }>("update_my_todo", {
        id: todoId,
        content: ` ${content} `,
        mode: "full",
      });

      expect(result.success).toBe(true);
      expect(result.todo?.id).toBe(todoId);
      expect(result.todo?.content).toBe(content);
    } finally {
      await deleteIntegrationTodo(todoId);
    }
  });

  it("update_my_todo clears content when content is explicitly null", async () => {
    const todoId = await createIntegrationTodo("clear content");
    try {
      const result = await context.client.call<{
        success?: boolean;
        todo?: {
          id?: string;
          content?: string | null;
        } | null;
      }>("update_my_todo", {
        id: todoId,
        content: null,
        mode: "full",
      });

      expect(result.success).toBe(true);
      expect(result.todo?.id).toBe(todoId);
      expect(result.todo?.content).toBeNull();
    } finally {
      await deleteIntegrationTodo(todoId);
    }
  });

  it("delete_my_todo deletes a todo", async () => {
    const todoId = await createIntegrationTodo("delete");
    try {
      const result = await context.client.call<{ success?: boolean }>(
        "delete_my_todo",
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
      await deleteIntegrationTodo(todoId);
    }
  });

  it("create_my_todo returns the new todo id", async () => {
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
      await deleteIntegrationTodo(todoId);
    }
  });
});

// ---------------------------------------------------------------------------
// Homeworks
// ---------------------------------------------------------------------------

describe("homework write tools — MCP mirrors ordinary-user REST writes", () => {
  it("delete_homework_on_section deletes creator-owned homework and records audit", async () => {
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
        createdById: context.devUserId,
        updatedById: context.devUserId,
      },
      select: { id: true },
    });

    try {
      const deleted = await context.client.call<{
        alreadyDeleted?: boolean;
        deletedId?: string;
        success?: boolean;
      }>("delete_homework_on_section", {
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
      expect(record?.deletedById).toBe(context.devUserId);

      const audit = await fixtures.prisma.homeworkAuditLog.findFirst({
        where: {
          homeworkId: homework.id,
          action: "deleted",
          actorId: context.devUserId,
        },
      });
      expect(audit?.id).toBeTypeOf("string");
    } finally {
      await fixtures.prisma.homeworkAuditLog.deleteMany({
        where: { homeworkId: homework.id },
      });
      await fixtures.prisma.homework.deleteMany({ where: { id: homework.id } });
    }
  });

  it("delete_homework_on_section serializes not-found and non-owner failures", async () => {
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
      const notFound = await context.client.call<{
        error?: string;
        success?: boolean;
      }>("delete_homework_on_section", {
        homeworkId: "missing-homework-id",
      });
      expect(notFound).toMatchObject({
        success: false,
        error: "not_found",
      });

      const forbidden = await context.client.call<{
        error?: string;
        success?: boolean;
      }>("delete_homework_on_section", {
        homeworkId: homework.id,
      });
      expect(forbidden).toMatchObject({
        success: false,
        error: "forbidden",
      });
    } finally {
      await fixtures.prisma.homeworkAuditLog.deleteMany({
        where: { homeworkId: homework.id },
      });
      await fixtures.prisma.homework.deleteMany({ where: { id: homework.id } });
      await fixtures.prisma.user.deleteMany({ where: { id: otherUser.id } });
    }
  });
});

// ---------------------------------------------------------------------------
// Flexible date inputs
// ---------------------------------------------------------------------------
