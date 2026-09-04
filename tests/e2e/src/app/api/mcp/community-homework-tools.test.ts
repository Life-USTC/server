/**
 * MCP seeded tools — 种子工具：班级作业读写
 */

import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { parseTextContent } from "./helpers";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("种子工具：班级作业读写", async ({ page, request }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;

    let createdHomeworkId: string | null = null;
    try {
      const homeworksResult = await mcpClient.callTool({
        name: "community_section_homework_list",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
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
      expect(homeworksPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect(
        homeworksPayload.homeworks?.some(
          (homework) => homework.title === DEV_SEED.homeworks.title,
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
      const createHomeworkResult = await mcpClient.callTool({
        name: "community_section_homework_create",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          title: homeworkTitle,
          description: "homework created by mcp e2e",
          publishedAt: "2026-04-29T09:00:00+08:00",
          submissionStartAt: "2026-04-29T09:00:00+08:00",
          submissionDueAt: "2026-05-12T23:00:00+08:00",
          locale: "zh-cn",
        },
      });
      const createHomeworkPayload = parseTextContent(createHomeworkResult) as {
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
      createdHomeworkId = createHomeworkPayload.id ?? null;
      expect(createHomeworkPayload.homework?.id).toBe(createHomeworkPayload.id);
      expect(createHomeworkPayload.homework?.title).toBe(homeworkTitle);
      expect(createHomeworkPayload.homework?.section?.jwId).toBe(
        DEV_SEED.section.jwId,
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
      const updateHomeworkPayload = parseTextContent(updateHomeworkResult) as {
        success?: boolean;
        homework?: {
          id?: string;
          title?: string;
          requiresTeam?: boolean;
          description?: { content?: string } | null;
        } | null;
      };
      expect(updateHomeworkPayload.success).toBe(true);
      expect(updateHomeworkPayload.homework?.id).toBe(createHomeworkPayload.id);
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

      const deleteHomeworkResult = await mcpClient.callTool({
        name: "community_section_homework_delete",
        arguments: {
          homeworkId: createHomeworkPayload.id,
        },
      });
      const deleteHomeworkPayload = parseTextContent(deleteHomeworkResult) as {
        alreadyDeleted?: boolean;
        deletedId?: string;
        success?: boolean;
      };
      expect(deleteHomeworkPayload).toEqual({
        success: true,
        deletedId: createHomeworkPayload.id,
        alreadyDeleted: false,
      });
      createdHomeworkId = null;
    } finally {
      await closeSeededMcpSession(page, session, { createdHomeworkId });
    }
  });
});
