import { expect } from "@playwright/test";
import { arrangeHomework, arrangeSection, facts } from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

test("MCP homework completion commits and clears the owned state", async ({
  mcp,
  oauth,
}) => {
  const db = oauth.worker.database.owner;
  const userId = oauth.user.id;
  const section = await arrangeSection(db);
  const homework = await arrangeHomework(db, userId, section.id);
  await db.userSectionSubscription.create({
    data: { userId, sectionId: section.id },
  });

  const complete = await mcp.callTool({
    name: "workspace_homework_completion_set",
    arguments: { homeworkId: homework.id, completed: true },
  });
  expect(complete.isError).not.toBe(true);
  expect(parseTextContent(complete)).toMatchObject({
    success: true,
    completion: { completed: true },
  });
  expect(await db.homeworkCompletion.findMany()).toEqual([
    { userId, homeworkId: homework.id, completedAt: expect.any(Date) },
  ]);

  const reopen = await mcp.callTool({
    name: "workspace_homework_completion_set",
    arguments: { homeworkId: homework.id, completed: false },
  });
  expect(reopen.isError).not.toBe(true);
  expect(parseTextContent(reopen)).toMatchObject({
    success: true,
    completion: { completed: false },
  });
  expect(await db.homeworkCompletion.findMany()).toEqual([]);
  expect(
    await db.homework.findUniqueOrThrow({ where: { id: homework.id } }),
  ).toEqual(homework);
});

test("MCP todo create update delete commits each transition", async ({
  mcp,
  oauth,
}) => {
  const db = oauth.worker.database.owner;
  const input = {
    title: "Private MCP todo",
    content: "todo created by mcp e2e",
    priority: "medium",
    dueAt: "2026-04-29T15:00:00+08:00",
  };
  const create = await mcp.callTool({
    name: "workspace_todo_create",
    arguments: input,
  });
  expect(create.isError).not.toBe(true);
  const created = parseTextContent(create);
  expect(created).toMatchObject({ success: true, id: expect.any(String) });
  const expected = {
    ...input,
    id: created.id,
    userId: oauth.user.id,
    dueAt: new Date(input.dueAt),
    completed: false,
  };
  expect(await db.todo.findMany()).toMatchObject([expected]);

  const update = await mcp.callTool({
    name: "workspace_todo_update",
    arguments: {
      id: created.id,
      title: `${input.title}-updated`,
      completed: true,
    },
  });
  expect(update.isError).not.toBe(true);
  expect(parseTextContent(update)).toMatchObject({ success: true });
  expect(await db.todo.findMany()).toMatchObject([
    { ...expected, title: `${input.title}-updated`, completed: true },
  ]);

  const remove = await mcp.callTool({
    name: "workspace_todo_delete",
    arguments: { id: created.id },
  });
  expect(remove.isError).not.toBe(true);
  expect(parseTextContent(remove)).toMatchObject({ success: true });
  expect(await db.todo.findMany()).toEqual([]);
});

test("MCP importing an existing subscription preserves its complete membership", async ({
  mcp,
  oauth,
}) => {
  const db = oauth.worker.database.owner;
  const section = await arrangeSection(db);
  const membership = await db.userSectionSubscription.create({
    data: { userId: oauth.user.id, sectionId: section.id },
  });
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
  expect(payload.subscription).not.toHaveProperty("currentSemesterSections");
  expect(payload.subscription).not.toHaveProperty("sections");
  expect(await db.userSectionSubscription.findMany()).toEqual([membership]);
});
