import { expect } from "@playwright/test";
import type { Prisma } from "../../../../../../src/generated/prisma-node/client";
import { arrangeHomework, arrangeSection, facts } from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

for (const completed of [true, false]) {
  test(`MCP homework ${completed ? "completion" : "reopening"} commits independently`, {
    tag: "@Homework/MCP",
  }, async ({ mcpRun }) => {
    await mcpRun(
      {
        calls: [
          ["workspace_homework_completion_set", "workspace.homework", "write"],
        ],
        usage: [["workspace.homework", 0, 1]],
      },
      async ({ mcp, oauth, observeCalendar }) => {
        const db = oauth.worker.database.owner;
        const userId = oauth.user.id;
        const { homework, other, membership, retained } = await db.$transaction(
          async (tx) => {
            const section = await arrangeSection(tx);
            const homework = await arrangeHomework(tx, userId, section.id);
            const other = await tx.homework.create({
              data: {
                sectionId: section.id,
                createdById: userId,
                title: "Unchanged homework",
              },
            });
            const membership = await tx.userSectionSubscription.create({
              data: { userId, sectionId: section.id },
            });
            const retained = await tx.homeworkCompletion.create({
              data: {
                userId,
                homeworkId: other.id,
                completedAt: new Date("2026-04-28T12:00:00+08:00"),
              },
            });
            if (!completed)
              await tx.homeworkCompletion.create({
                data: {
                  userId,
                  homeworkId: homework.id,
                  completedAt: new Date("2026-04-29T12:00:00+08:00"),
                },
              });
            return { homework, other, membership, retained };
          },
        );
        await observeCalendar([{ type: "user", userId }]);
        const startedAt = Date.now();
        const result = await mcp.callTool({
          name: "workspace_homework_completion_set",
          arguments: { homeworkId: homework.id, completed },
        });
        const finishedAt = Date.now();
        expect(result.isError).not.toBe(true);
        expect(parseTextContent(result)).toMatchObject({
          success: true,
          completion: { completed },
        });
        return {
          async verifyState() {
            const rows = await db.homeworkCompletion.findMany();
            expect(rows).toHaveLength(completed ? 2 : 1);
            expect(rows).toEqual(expect.arrayContaining([retained]));
            if (completed) {
              const changed = rows.find(
                (row) => row.homeworkId === homework.id,
              );
              expect(changed).toEqual({
                userId,
                homeworkId: homework.id,
                completedAt: expect.any(Date),
              });
              expect(changed?.completedAt.getTime()).toBeGreaterThanOrEqual(
                startedAt,
              );
              expect(changed?.completedAt.getTime()).toBeLessThanOrEqual(
                finishedAt,
              );
            } else expect(rows).toEqual([retained]);
            expect(await db.homework.findMany()).toHaveLength(2);
            expect(
              await db.homework.findUniqueOrThrow({
                where: { id: homework.id },
              }),
            ).toEqual(homework);
            expect(
              await db.homework.findUniqueOrThrow({ where: { id: other.id } }),
            ).toEqual(other);
            expect(await db.userSectionSubscription.findMany()).toEqual([
              membership,
            ]);
          },
        };
      },
    );
  });
}

const todoInput = {
  title: "Private MCP todo",
  content: "todo created by mcp e2e",
  priority: "medium" as const,
  dueAt: "2026-04-29T15:00:00+08:00",
};
async function arrangeUntouchedTodo(
  db: Prisma.TransactionClient,
  userId: string,
) {
  return db.todo.create({
    data: {
      userId,
      title: "Unchanged MCP todo",
      content: "Unchanged private content",
    },
  });
}

test("MCP todo create commits independently", { tag: "@Todo/MCP" }, async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [["workspace_todo_create", "workspace.todo", "write"]],
      usage: [["workspace.todo", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const retained = await arrangeUntouchedTodo(db, userId);
      await observeCalendar([{ type: "user", userId }]);
      const result = await mcp.callTool({
        name: "workspace_todo_create",
        arguments: todoInput,
      });
      expect(result.isError).not.toBe(true);
      const created = parseTextContent(result);
      expect(created).toMatchObject({ success: true, id: expect.any(String) });
      return {
        async verifyState() {
          const rows = await db.todo.findMany();
          expect(rows).toHaveLength(2);
          expect(rows).toEqual(
            expect.arrayContaining([
              retained,
              {
                ...todoInput,
                id: created.id,
                userId,
                dueAt: new Date(todoInput.dueAt),
                completed: false,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ]),
          );
        },
      };
    },
  );
});

test("MCP todo update commits independently", { tag: "@Todo/MCP" }, async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [["workspace_todo_update", "workspace.todo", "write"]],
      usage: [["workspace.todo", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { target, retained } = await db.$transaction(async (tx) => ({
        target: await tx.todo.create({
          data: { ...todoInput, dueAt: new Date(todoInput.dueAt), userId },
        }),
        retained: await arrangeUntouchedTodo(tx, userId),
      }));
      await observeCalendar([{ type: "user", userId }]);
      const result = await mcp.callTool({
        name: "workspace_todo_update",
        arguments: {
          id: target.id,
          title: "Private MCP todo-updated",
          completed: true,
        },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toMatchObject({ success: true });
      return {
        async verifyState() {
          const rows = await db.todo.findMany();
          expect(rows).toHaveLength(2);
          expect(rows).toEqual(
            expect.arrayContaining([
              retained,
              {
                ...target,
                title: "Private MCP todo-updated",
                completed: true,
                updatedAt: expect.any(Date),
              },
            ]),
          );
        },
      };
    },
  );
});

test("MCP todo delete commits independently", { tag: "@Todo/MCP" }, async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [["workspace_todo_delete", "workspace.todo", "write"]],
      usage: [["workspace.todo", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { target, retained } = await db.$transaction(async (tx) => ({
        target: await tx.todo.create({
          data: {
            ...todoInput,
            dueAt: new Date(todoInput.dueAt),
            userId,
            completed: true,
          },
        }),
        retained: await arrangeUntouchedTodo(tx, userId),
      }));
      await observeCalendar([{ type: "user", userId }]);
      const result = await mcp.callTool({
        name: "workspace_todo_delete",
        arguments: { id: target.id },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toMatchObject({ success: true });
      return {
        async verifyState() {
          expect(await db.todo.findMany()).toEqual([retained]);
        },
      };
    },
  );
});

test("MCP importing an existing subscription preserves its complete membership", {
  tag: "@Subscription/MCP",
}, async ({ mcpRun }) => {
  await mcpRun(
    {
      calls: [
        ["workspace_subscription_import", "workspace.subscription", "write"],
      ],
      usage: [["workspace.subscription", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const membership = await db.$transaction(async (tx) => {
        const section = await arrangeSection(tx);
        return tx.userSectionSubscription.create({
          data: { userId: oauth.user.id, sectionId: section.id },
        });
      });
      await observeCalendar([{ type: "user", userId: oauth.user.id }]);

      const result = await mcp.callTool({
        name: "workspace_subscription_import",
        arguments: { codes: [facts.section.code], locale: "zh-cn" },
      });
      expect(result.isError).not.toBe(true);
      const payload = parseTextContent(result);
      expect(payload).toMatchObject({
        success: true,
        matchedCodes: [facts.section.code],
        subscription: { sectionCount: 1 },
      });
      expect(payload.subscription).not.toHaveProperty(
        "currentSemesterSections",
      );
      expect(payload.subscription).not.toHaveProperty("sections");
      expect(await db.userSectionSubscription.findMany()).toEqual([membership]);
      return {
        async verifyState() {
          expect(await db.userSectionSubscription.findMany()).toEqual([
            membership,
          ]);
        },
      };
    },
  );
});
