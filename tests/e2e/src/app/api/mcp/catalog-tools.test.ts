/**
 * MCP seeded tools — 种子工具：目录课程与教学班
 */

import { expect, test } from "@playwright/test";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import { parseTextContent } from "./helpers";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("种子工具：目录课程与教学班", async ({ page, request }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;

    try {
      const coursesResult = await mcpClient.callTool({
        name: "catalog_course_search",
        arguments: {
          search: DEV_SEED.course.code,
          limit: 5,
          locale: "zh-cn",
        },
      });
      const coursesPayload = parseTextContent(coursesResult) as {
        data?: Array<{
          jwId?: number;
          code?: string | null;
          namePrimary?: string | null;
        }>;
        pagination?: { pageSize?: number; total?: number };
      };
      expect(coursesPayload.pagination?.pageSize).toBe(5);
      expect(
        coursesPayload.data?.some(
          (course) =>
            course.jwId === DEV_SEED.course.jwId &&
            course.code === DEV_SEED.course.code &&
            course.namePrimary === DEV_SEED.course.nameCn,
        ),
      ).toBe(true);

      const sectionResult = await mcpClient.callTool({
        name: "catalog_section_get",
        arguments: {
          jwId: DEV_SEED.section.jwId,
          locale: "zh-cn",
        },
      });
      const sectionPayload = parseTextContent(sectionResult) as {
        found?: boolean;
        section?: {
          id?: number;
          jwId?: number;
          code?: string | null;
          course?: { code?: string | null; namePrimary?: string | null };
        };
      };
      expect(sectionPayload.found).toBe(true);
      expect(sectionPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect(sectionPayload.section?.code).toBe(DEV_SEED.section.code);
      expect(sectionPayload.section?.course?.code).toBe(DEV_SEED.course.code);
      expect(sectionPayload.section?.course?.namePrimary).toBe(
        DEV_SEED.course.nameCn,
      );

      const filteredSectionsResult = await mcpClient.callTool({
        name: "catalog_section_search",
        arguments: {
          courseJwId: DEV_SEED.course.jwId,
          semesterJwId: DEV_SEED.semesterJwId,
          teacherCode: DEV_SEED.teacher.code,
          jwIds: [DEV_SEED.section.jwId],
          locale: "zh-cn",
        },
      });
      const filteredSectionsPayload = parseTextContent(
        filteredSectionsResult,
      ) as {
        data?: Array<{ jwId?: number; code?: string | null }>;
        pagination?: { total?: number };
      };
      expect(filteredSectionsPayload.pagination?.total).toBe(1);
      expect(filteredSectionsPayload.data?.[0]?.jwId).toBe(
        DEV_SEED.section.jwId,
      );
      expect(filteredSectionsPayload.data?.[0]?.code).toBe(
        DEV_SEED.section.code,
      );
      const schedulesResult = await mcpClient.callTool({
        name: "catalog_section_schedule_list",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          limit: 20,
          locale: "zh-cn",
        },
      });
      const schedulesPayload = parseTextContent(schedulesResult) as {
        found?: boolean;
        section?: { jwId?: number };
        schedules?: Array<{ id?: number; section?: unknown }>;
      };
      expect(schedulesPayload.found).toBe(true);
      expect(schedulesPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect((schedulesPayload.schedules?.length ?? 0) > 0).toBe(true);
      expect(
        schedulesPayload.schedules?.every(
          (schedule) => !Object.hasOwn(schedule, "section"),
        ),
      ).toBe(true);

      const queriedSchedulesResult = await mcpClient.callTool({
        name: "catalog_schedule_list",
        arguments: {
          sectionCode: DEV_SEED.section.code,
          teacherCode: DEV_SEED.teacher.code,
          roomJwId: 9910031,
          dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
          dateTo: "2026-05-10T23:59:59+08:00",
          locale: "zh-cn",
        },
      });
      const queriedSchedulesPayload = parseTextContent(
        queriedSchedulesResult,
      ) as {
        data?: Array<{
          section?: { jwId?: number; code?: string | null };
          room?: { jwId?: number | null };
          teachers?: Array<{ code?: string | null }>;
        }>;
        pagination?: { total?: number };
      };
      expect((queriedSchedulesPayload.pagination?.total ?? 0) > 0).toBe(true);
      expect(
        queriedSchedulesPayload.data?.every(
          (schedule) =>
            schedule.section?.code === DEV_SEED.section.code &&
            schedule.room?.jwId === 9910031 &&
            schedule.teachers?.some(
              (teacher) => teacher.code === DEV_SEED.teacher.code,
            ) === true,
        ),
      ).toBe(true);

      const examsResult = await mcpClient.callTool({
        name: "catalog_section_exam_list",
        arguments: {
          sectionJwId: DEV_SEED.section.jwId,
          locale: "zh-cn",
        },
      });
      const examsPayload = parseTextContent(examsResult) as {
        found?: boolean;
        section?: { jwId?: number };
        exams?: Array<{ id?: number }>;
      };
      expect(examsPayload.found).toBe(true);
      expect(examsPayload.section?.jwId).toBe(DEV_SEED.section.jwId);
      expect((examsPayload.exams?.length ?? 0) > 0).toBe(true);
      const matchSectionCodesResult = await mcpClient.callTool({
        name: "catalog_section_match_preview",
        arguments: {
          codes: [DEV_SEED.section.code, "NOT-EXIST-CODE"],
          locale: "zh-cn",
        },
      });
      const matchSectionCodesPayload = parseTextContent(
        matchSectionCodesResult,
      ) as {
        success?: boolean;
        matchedCodes?: string[];
        unmatchedCodes?: string[];
        suggestions?: Record<string, string[]>;
      };
      expect(matchSectionCodesPayload.success).toBe(true);
      expect(matchSectionCodesPayload.matchedCodes).toContain(
        DEV_SEED.section.code,
      );
      expect(matchSectionCodesPayload.unmatchedCodes).toContain(
        "NOT-EXIST-CODE",
      );

      const fuzzySectionCode = DEV_SEED.section.code.replace(/\.\d+$/, ".0");
      const fuzzyMatchSectionCodesResult = await mcpClient.callTool({
        name: "catalog_section_match_preview",
        arguments: {
          codes: [fuzzySectionCode],
          locale: "zh-cn",
        },
      });
      const fuzzyMatchPayload = parseTextContent(
        fuzzyMatchSectionCodesResult,
      ) as {
        suggestions?: Record<string, string[]>;
      };
      expect(fuzzyMatchPayload.suggestions?.[fuzzySectionCode]).toEqual([
        DEV_SEED.section.code,
      ]);

      const missingSectionResult = await mcpClient.callTool({
        name: "catalog_section_get",
        arguments: {
          jwId: 999999999,
          locale: "zh-cn",
        },
      });
      const missingSectionPayload = parseTextContent(missingSectionResult) as {
        found?: boolean;
        message?: string;
      };
      expect(missingSectionPayload.found).toBe(false);
      expect(missingSectionPayload.message).toContain("999999999");
    } finally {
      await closeSeededMcpSession(page, session);
    }
  });
});
