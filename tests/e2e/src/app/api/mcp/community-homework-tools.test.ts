/**
 * MCP seeded tools — 种子工具：班级作业读写
 */

import { expect } from "@playwright/test";
import { arrangeHomework, arrangeSection, facts } from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test("种子工具：班级作业读写", async ({ mcpRun }) => {
    await mcpRun(
      {
        calls: [
          [
            "community_section_homework_list",
            "community.section-homework",
            "read",
          ],
          [
            "community_section_homework_create",
            "community.section-homework",
            "write",
          ],
          [
            "community_section_homework_update",
            "community.section-homework",
            "write",
          ],
          [
            "community_section_homework_update",
            "community.section-homework",
            "write",
          ],
          [
            "community_section_homework_update",
            "community.section-homework",
            "write",
          ],
          [
            "community_section_homework_delete",
            "community.section-homework",
            "write",
          ],
        ],
        usage: [["community.section-homework", 1, 5]],
      },
      async ({ mcp: mcpClient, oauth, observeCalendar }) => {
        const db = oauth.worker.database.owner;
        const { section, seed } = await db.$transaction(async (tx) => {
          const section = await arrangeSection(tx);
          const seed = await arrangeHomework(tx, oauth.user.id, section.id);
          return { section, seed };
        });
        await observeCalendar(
          [
            { type: "section", sectionId: section.id },
            { type: "section", sectionId: section.id },
            { type: "section", sectionId: section.id },
            { type: "section", sectionId: section.id },
          ],
          { sectionId: section.id, calendar: "absent" },
        );

        const homeworksResult = await mcpClient.callTool({
          name: "community_section_homework_list",
          arguments: {
            sectionJwId: facts.section.jwId,
            includeDeleted: false,
            locale: "zh-cn",
          },
        });
        const homeworksPayload = parseTextContent(homeworksResult) as {
          found?: boolean;
          section?: { jwId?: number };
          homeworks?: Array<{
            title?: string;
            section?: { jwId?: number };
            createdBy?: unknown;
            completion?: { completedAt?: string } | null;
            commentCount?: number;
          }>;
        };
        expect(homeworksPayload.found).toBe(true);
        expect(homeworksPayload.section?.jwId).toBe(facts.section.jwId);
        expect(
          homeworksPayload.homeworks?.some(
            (homework) => homework.title === facts.homeworks.title,
          ),
        ).toBe(true);
        expect(
          homeworksPayload.homeworks?.every(
            (homework) =>
              !Object.hasOwn(homework, "section") &&
              !Object.hasOwn(homework, "createdBy") &&
              typeof homework.commentCount === "number" &&
              Object.hasOwn(homework, "completion"),
          ),
        ).toBe(true);
        const homeworkTitle = `[MCP-E2E-HW] ${Date.now()}`;
        const createHomeworkResult = await mcpClient.callTool({
          name: "community_section_homework_create",
          arguments: {
            sectionJwId: facts.section.jwId,
            title: homeworkTitle,
            description: "homework created by mcp e2e",
            publishedAt: "2026-04-29T09:00:00+08:00",
            submissionStartAt: "2026-04-29T09:00:00+08:00",
            submissionDueAt: "2026-05-12T23:00:00+08:00",
            locale: "zh-cn",
          },
        });
        const createHomeworkPayload = parseTextContent(
          createHomeworkResult,
        ) as {
          success?: boolean;
          id?: string;
          homework?: {
            id?: string;
            title?: string;
            section?: { jwId?: number };
            commentCount?: number;
          } | null;
        };
        expect(createHomeworkPayload.success).toBe(true);
        expect(typeof createHomeworkPayload.id).toBe("string");
        expect(createHomeworkPayload.homework?.id).toBe(
          createHomeworkPayload.id,
        );
        expect(createHomeworkPayload.homework?.title).toBe(homeworkTitle);
        expect(createHomeworkPayload.homework?.section?.jwId).toBe(
          facts.section.jwId,
        );
        expect(typeof createHomeworkPayload.homework?.commentCount).toBe(
          "number",
        );

        const updateHomeworkResult = await mcpClient.callTool({
          name: "community_section_homework_update",
          arguments: {
            homeworkId: createHomeworkPayload.id,
            title: `${homeworkTitle}-updated`,
            description: "homework updated by mcp e2e",
            requiresTeam: true,
            submissionDueAt: "2026-05-15T23:00:00+08:00",
          },
        });
        const updateHomeworkPayload = parseTextContent(
          updateHomeworkResult,
        ) as {
          success?: boolean;
          homework?: {
            id?: string;
            title?: string;
            requiresTeam?: boolean;
            description?: { content?: string } | null;
          } | null;
        };
        expect(updateHomeworkPayload.success).toBe(true);
        expect(updateHomeworkPayload.homework?.id).toBe(
          createHomeworkPayload.id,
        );
        expect(updateHomeworkPayload.homework?.title).toBe(
          `${homeworkTitle}-updated`,
        );
        expect(updateHomeworkPayload.homework?.requiresTeam).toBe(true);
        expect(updateHomeworkPayload.homework?.description?.content).toBe(
          "homework updated by mcp e2e",
        );

        const descriptionOnlyResult = await mcpClient.callTool({
          name: "community_section_homework_update",
          arguments: {
            homeworkId: createHomeworkPayload.id,
            description: "homework description-only update by mcp e2e",
          },
        });
        const descriptionOnlyPayload = parseTextContent(
          descriptionOnlyResult,
        ) as {
          success?: boolean;
          homework?: {
            description?: { content?: string } | null;
            id?: string;
            requiresTeam?: boolean;
            title?: string;
          } | null;
        };
        expect(descriptionOnlyPayload.success).toBe(true);
        expect(descriptionOnlyPayload.homework?.id).toBe(
          createHomeworkPayload.id,
        );
        expect(descriptionOnlyPayload.homework?.title).toBe(
          `${homeworkTitle}-updated`,
        );
        expect(descriptionOnlyPayload.homework?.requiresTeam).toBe(true);
        expect(descriptionOnlyPayload.homework?.description?.content).toBe(
          "homework description-only update by mcp e2e",
        );

        const noChangeHomeworkResult = await mcpClient.callTool({
          name: "community_section_homework_update",
          arguments: {
            homeworkId: createHomeworkPayload.id,
          },
        });
        const noChangeHomeworkPayload = parseTextContent(
          noChangeHomeworkResult,
        ) as {
          message?: string;
          success?: boolean;
        };
        expect(noChangeHomeworkPayload).toMatchObject({
          message: "No changes",
          success: false,
        });

        const deleteStartedAt = Date.now();
        const deleteHomeworkResult = await mcpClient.callTool({
          name: "community_section_homework_delete",
          arguments: {
            homeworkId: createHomeworkPayload.id,
          },
        });
        const deleteHomeworkPayload = parseTextContent(
          deleteHomeworkResult,
        ) as {
          alreadyDeleted?: boolean;
          deletedId?: string;
          success?: boolean;
        };
        expect(deleteHomeworkPayload).toEqual({
          success: true,
          deletedId: createHomeworkPayload.id,
          alreadyDeleted: false,
        });
        const deletedAt = Date.now();
        const id = createHomeworkPayload.id;
        if (!id) throw new Error("Missing created homework ID");
        const description = await db.description.findUniqueOrThrow({
          where: { homeworkId: id },
          select: { id: true },
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
            {
              ...attribution,
              action: "homework_update",
              targetId: id,
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
            {
              ...attribution,
              action: "homework_update",
              targetId: id,
              targetType: "homework",
              metadata: {
                sectionId: section.id,
                changedFields: ["description"],
              },
            },
            {
              ...attribution,
              action: "homework_delete",
              targetId: id,
              targetType: "homework",
              metadata: { sectionId: section.id },
            },
            {
              outcome: "success",
              channel: "web",
              userId: oauth.user.id,
              subjectUserId: oauth.user.id,
              oauthClientId: null,
              oauthGrantId: null,
              sessionId: null,
              action: "description_edit",
              targetId: description.id,
              targetType: "description",
              metadata: { targetType: "homework", changedFields: ["content"] },
            },
            {
              outcome: "success",
              channel: "web",
              userId: oauth.user.id,
              subjectUserId: oauth.user.id,
              oauthClientId: null,
              oauthGrantId: null,
              sessionId: null,
              action: "description_edit",
              targetId: description.id,
              targetType: "description",
              metadata: { targetType: "homework", changedFields: ["content"] },
            },
          ],
          async verifyState() {
            expect(
              await db.homework.findUniqueOrThrow({ where: { id: seed.id } }),
            ).toEqual(seed);
            expect(await db.homework.count()).toBe(2);
            const deleted = await db.homework.findUniqueOrThrow({
              where: { id },
              include: { description: true },
            });
            expect(deleted).toMatchObject({
              id,
              sectionId: section.id,
              createdById: oauth.user.id,
              updatedById: oauth.user.id,
              deletedById: oauth.user.id,
              title: `${homeworkTitle}-updated`,
              requiresTeam: true,
              publishedAt: new Date("2026-04-29T09:00:00+08:00"),
              submissionStartAt: new Date("2026-04-29T09:00:00+08:00"),
              submissionDueAt: new Date("2026-05-15T23:00:00+08:00"),
              description: {
                id: description.id,
                content: "homework description-only update by mcp e2e",
              },
              deletedAt: expect.any(Date),
            });
            expect(deleted.deletedAt?.getTime()).toBeGreaterThanOrEqual(
              deleteStartedAt,
            );
            expect(deleted.deletedAt?.getTime()).toBeLessThanOrEqual(deletedAt);
            expect(await db.userSectionSubscription.findMany()).toEqual([]);
            expect(await db.homeworkCompletion.findMany()).toEqual([]);
          },
        };
      },
    );
  });
});
