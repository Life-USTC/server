import { expect } from "@playwright/test";
import type { Prisma } from "../../../../../../src/generated/prisma-node/client";
import { arrangeHomework, arrangeSection, facts } from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

type Database = Prisma.TransactionClient;
const dates = {
  publishedAt: "2026-04-29T09:00:00+08:00",
  submissionStartAt: "2026-04-29T09:00:00+08:00",
  submissionDueAt: "2026-05-12T23:00:00+08:00",
};
async function arrangeCommunity(db: Database, userId: string) {
  const section = await arrangeSection(db);
  const seed = await arrangeHomework(db, userId, section.id);
  return { section, seed };
}
async function arrangeMutation(
  db: Database,
  userId: string,
  requiresTeam: boolean,
) {
  const { section, seed } = await arrangeCommunity(db, userId);
  const target = await db.homework.create({
    data: {
      sectionId: section.id,
      createdById: userId,
      updatedById: userId,
      title: "Prepared MCP homework",
      requiresTeam,
      publishedAt: new Date(dates.publishedAt),
      submissionStartAt: new Date(dates.submissionStartAt),
      submissionDueAt: new Date(dates.submissionDueAt),
    },
  });
  const description = await db.description.create({
    data: {
      homeworkId: target.id,
      content: "Prepared homework description",
      lastEditedAt: new Date("2026-04-29T09:00:00+08:00"),
      lastEditedById: userId,
    },
  });
  return { section, seed, target, description };
}
async function expectState(
  db: Database,
  homeworks: unknown[],
  descriptions: unknown[],
) {
  const actualHomeworks = await db.homework.findMany();
  expect(actualHomeworks).toHaveLength(homeworks.length);
  expect(actualHomeworks).toEqual(expect.arrayContaining(homeworks));
  const actualDescriptions = await db.description.findMany();
  expect(actualDescriptions).toHaveLength(descriptions.length);
  expect(actualDescriptions).toEqual(expect.arrayContaining(descriptions));
  expect(await db.userSectionSubscription.findMany()).toEqual([]);
  expect(await db.homeworkCompletion.findMany()).toEqual([]);
}
function descriptionAudit(userId: string, descriptionId: string) {
  return {
    outcome: "success" as const,
    channel: "web" as const,
    userId,
    subjectUserId: userId,
    oauthClientId: null,
    oauthGrantId: null,
    sessionId: null,
    action: "description_edit",
    targetId: descriptionId,
    targetType: "description",
    metadata: { targetType: "homework", changedFields: ["content"] },
  };
}

test("MCP section homework list consumes independently prepared state", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_list",
          "community.section-homework",
          "read",
        ],
      ],
      usage: [["community.section-homework", 1, 0]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const { section, seed } = await db.$transaction((tx) =>
        arrangeCommunity(tx, oauth.user.id),
      );
      await observeCalendar([], { sectionId: section.id, calendar: "absent" });
      const result = await mcp.callTool({
        name: "community_section_homework_list",
        arguments: {
          sectionJwId: facts.section.jwId,
          includeDeleted: false,
          locale: "zh-cn",
        },
      });
      expect(result.isError).not.toBe(true);
      const payload = parseTextContent(result) as {
        found: boolean;
        section: { jwId: number };
        homeworks: Record<string, unknown>[];
      };
      expect(payload.found).toBe(true);
      expect(payload.section.jwId).toBe(facts.section.jwId);
      expect(payload.homeworks).toHaveLength(1);
      expect(payload.homeworks[0]).toMatchObject({
        title: facts.homeworks.title,
        commentCount: 0,
        completion: null,
      });
      expect(payload.homeworks[0]).not.toHaveProperty("section");
      expect(payload.homeworks[0]).not.toHaveProperty("createdBy");
      return {
        async verifyState() {
          await expectState(db, [seed], []);
        },
      };
    },
  );
});

test("MCP section homework create commits independently", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_create",
          "community.section-homework",
          "write",
        ],
      ],
      usage: [["community.section-homework", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { section, seed } = await db.$transaction((tx) =>
        arrangeCommunity(tx, userId),
      );
      await observeCalendar([{ type: "section", sectionId: section.id }], {
        sectionId: section.id,
        calendar: "absent",
      });
      const title = "Homework created through MCP";
      const content = "homework created by mcp e2e";
      const result = await mcp.callTool({
        name: "community_section_homework_create",
        arguments: {
          sectionJwId: facts.section.jwId,
          title,
          description: content,
          ...dates,
          locale: "zh-cn",
        },
      });
      expect(result.isError).not.toBe(true);
      const payload = parseTextContent(result);
      expect(payload.id).toEqual(expect.any(String));
      const id = payload.id;
      if (typeof id !== "string")
        throw new Error("MCP create returned no homework ID");
      expect(payload).toMatchObject({
        success: true,
        homework: {
          id,
          title,
          section: { jwId: facts.section.jwId },
          commentCount: 0,
        },
      });
      return {
        audits: (attribution) => [
          {
            ...attribution,
            action: "homework_create",
            targetId: id,
            targetType: "homework",
            metadata: {
              sectionId: section.id,
              changedFields: [
                "title",
                "isMajor",
                "requiresTeam",
                "publishedAt",
                "submissionStartAt",
                "submissionDueAt",
                "description",
              ],
            },
          },
        ],
        async verifyState() {
          await expectState(
            db,
            [
              seed,
              {
                id,
                title,
                sectionId: section.id,
                isMajor: false,
                requiresTeam: false,
                createdById: userId,
                updatedById: userId,
                deletedById: null,
                deletedAt: null,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                publishedAt: new Date(dates.publishedAt),
                submissionStartAt: new Date(dates.submissionStartAt),
                submissionDueAt: new Date(dates.submissionDueAt),
              },
            ],
            [
              {
                id: expect.any(String),
                homeworkId: id,
                content,
                lastEditedById: userId,
                lastEditedAt: expect.any(Date),
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                sectionId: null,
                courseId: null,
                teacherId: null,
              },
            ],
          );
        },
      };
    },
  );
});

test("MCP section homework update commits independently", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_update",
          "community.section-homework",
          "write",
        ],
      ],
      usage: [["community.section-homework", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { section, seed, target, description } = await db.$transaction(
        (tx) => arrangeMutation(tx, userId, false),
      );
      await observeCalendar([{ type: "section", sectionId: section.id }], {
        sectionId: section.id,
        calendar: "absent",
      });
      const title = "Prepared MCP homework-updated";
      const content = "homework updated by mcp e2e";
      const result = await mcp.callTool({
        name: "community_section_homework_update",
        arguments: {
          homeworkId: target.id,
          title,
          description: content,
          requiresTeam: true,
          submissionDueAt: "2026-05-15T23:00:00+08:00",
        },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toMatchObject({
        success: true,
        homework: {
          id: target.id,
          title,
          requiresTeam: true,
          description: { content },
        },
      });
      return {
        audits: (attribution) => [
          {
            ...attribution,
            action: "homework_update",
            targetId: target.id,
            targetType: "homework",
            metadata: {
              sectionId: section.id,
              changedFields: [
                "description",
                "title",
                "requiresTeam",
                "submissionDueAt",
              ],
            },
          },
          descriptionAudit(userId, description.id),
        ],
        async verifyState() {
          await expectState(
            db,
            [
              seed,
              {
                ...target,
                title,
                requiresTeam: true,
                submissionDueAt: new Date("2026-05-15T23:00:00+08:00"),
                updatedById: userId,
                updatedAt: expect.any(Date),
              },
            ],
            [
              {
                ...description,
                content,
                lastEditedById: userId,
                lastEditedAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
          );
        },
      };
    },
  );
});

test("MCP section homework description-only update preserves homework fields", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_update",
          "community.section-homework",
          "write",
        ],
      ],
      usage: [["community.section-homework", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { section, seed, target, description } = await db.$transaction(
        (tx) => arrangeMutation(tx, userId, true),
      );
      await observeCalendar([{ type: "section", sectionId: section.id }], {
        sectionId: section.id,
        calendar: "absent",
      });
      const content = "homework description-only update by mcp e2e";
      const result = await mcp.callTool({
        name: "community_section_homework_update",
        arguments: { homeworkId: target.id, description: content },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toMatchObject({
        success: true,
        homework: {
          id: target.id,
          title: "Prepared MCP homework",
          requiresTeam: true,
          description: { content },
        },
      });
      return {
        audits: (attribution) => [
          {
            ...attribution,
            action: "homework_update",
            targetId: target.id,
            targetType: "homework",
            metadata: { sectionId: section.id, changedFields: ["description"] },
          },
          descriptionAudit(userId, description.id),
        ],
        async verifyState() {
          await expectState(
            db,
            [seed, target],
            [
              {
                ...description,
                content,
                lastEditedById: userId,
                lastEditedAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
          );
        },
      };
    },
  );
});

test("MCP section homework no-change update preserves independently prepared state", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_update",
          "community.section-homework",
          "write",
        ],
      ],
      usage: [["community.section-homework", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const { section, seed, target, description } = await db.$transaction(
        (tx) => arrangeMutation(tx, oauth.user.id, true),
      );
      await observeCalendar([], { sectionId: section.id, calendar: "absent" });
      const result = await mcp.callTool({
        name: "community_section_homework_update",
        arguments: { homeworkId: target.id },
      });
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toMatchObject({
        success: false,
        message: "No changes",
      });
      return {
        async verifyState() {
          await expectState(db, [seed, target], [description]);
        },
      };
    },
  );
});

test("MCP section homework delete commits independently", async ({
  mcpRun,
}) => {
  await mcpRun(
    {
      calls: [
        [
          "community_section_homework_delete",
          "community.section-homework",
          "write",
        ],
      ],
      usage: [["community.section-homework", 0, 1]],
    },
    async ({ mcp, oauth, observeCalendar }) => {
      const db = oauth.worker.database.owner;
      const userId = oauth.user.id;
      const { section, seed, target, description } = await db.$transaction(
        (tx) => arrangeMutation(tx, userId, true),
      );
      await observeCalendar([{ type: "section", sectionId: section.id }], {
        sectionId: section.id,
        calendar: "absent",
      });
      const startedAt = Date.now();
      const result = await mcp.callTool({
        name: "community_section_homework_delete",
        arguments: { homeworkId: target.id },
      });
      const finishedAt = Date.now();
      expect(result.isError).not.toBe(true);
      expect(parseTextContent(result)).toEqual({
        success: true,
        deletedId: target.id,
        alreadyDeleted: false,
      });
      return {
        audits: (attribution) => [
          {
            ...attribution,
            action: "homework_delete",
            targetId: target.id,
            targetType: "homework",
            metadata: { sectionId: section.id },
          },
        ],
        async verifyState() {
          await expectState(
            db,
            [
              seed,
              {
                ...target,
                updatedById: userId,
                deletedById: userId,
                deletedAt: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
            [description],
          );
          const deleted = await db.homework.findUniqueOrThrow({
            where: { id: target.id },
          });
          expect(deleted.deletedAt?.getTime()).toBeGreaterThanOrEqual(
            startedAt,
          );
          expect(deleted.deletedAt?.getTime()).toBeLessThanOrEqual(finishedAt);
        },
      };
    },
  );
});
