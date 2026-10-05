/**
 * MCP seeded tools — 种子工具：目录课程与教学班
 */

import { expect } from "@playwright/test";
import { anchor, arrangeAcademic, facts } from "./_data";
import { test } from "./_fixture";
import { parseTextContent } from "./helpers";

test.describe("/api/mcp - 种子工具覆盖", () => {
  for (const domain of ["Catalog", "Exam"] as const) {
    test(`种子工具：目录课程与教学班 ${domain}`, {
      tag: `@${domain}/MCP`,
    }, async ({ mcpRun }) => {
      await mcpRun(
        {
          calls:
            domain === "Exam"
              ? [["catalog_section_exam_list"]]
              : [
                  ["catalog_course_search"],
                  ["catalog_section_get"],
                  ["catalog_section_search"],
                  ["catalog_section_schedule_list"],
                  ["catalog_schedule_list"],
                  ["catalog_section_match_preview"],
                  ["catalog_section_match_preview"],
                  ["catalog_section_get"],
                ],
          usage: [],
        },
        async ({ mcp: mcpClient, oauth, observeCalendar }) => {
          await observeCalendar([], { calendar: "absent" });
          const db = oauth.worker.database.owner;
          await db.$transaction((tx) => arrangeAcademic(tx));
          const readCatalog = () =>
            db.$transaction([
              db.section.findMany(),
              db.schedule.findMany(),
              db.exam.findMany(),
            ]);
          const expectedCatalog = await readCatalog();

          if (domain === "Catalog") {
            const coursesResult = await mcpClient.callTool({
              name: "catalog_course_search",
              arguments: {
                search: facts.course.code,
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
                  course.jwId === facts.course.jwId &&
                  course.code === facts.course.code &&
                  course.namePrimary === facts.course.nameCn,
              ),
            ).toBe(true);

            const sectionResult = await mcpClient.callTool({
              name: "catalog_section_get",
              arguments: {
                jwId: facts.section.jwId,
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
            expect(sectionPayload.section?.jwId).toBe(facts.section.jwId);
            expect(sectionPayload.section?.code).toBe(facts.section.code);
            expect(sectionPayload.section?.course?.code).toBe(
              facts.course.code,
            );
            expect(sectionPayload.section?.course?.namePrimary).toBe(
              facts.course.nameCn,
            );

            const filteredSectionsResult = await mcpClient.callTool({
              name: "catalog_section_search",
              arguments: {
                courseJwId: facts.course.jwId,
                semesterJwId: facts.semesterJwId,
                teacherCode: facts.teacher.code,
                jwIds: [facts.section.jwId],
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
              facts.section.jwId,
            );
            expect(filteredSectionsPayload.data?.[0]?.code).toBe(
              facts.section.code,
            );
            const schedulesResult = await mcpClient.callTool({
              name: "catalog_section_schedule_list",
              arguments: {
                sectionJwId: facts.section.jwId,
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
            expect(schedulesPayload.section?.jwId).toBe(facts.section.jwId);
            expect((schedulesPayload.schedules?.length ?? 0) > 0).toBe(true);
            expect(
              schedulesPayload.schedules?.every(
                (schedule) => !Object.hasOwn(schedule, "section"),
              ),
            ).toBe(true);

            const queriedSchedulesResult = await mcpClient.callTool({
              name: "catalog_schedule_list",
              arguments: {
                sectionCode: facts.section.code,
                teacherCode: facts.teacher.code,
                roomJwId: facts.roomJwId,
                dateFrom: anchor.startOfDayAtTime,
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
            expect((queriedSchedulesPayload.pagination?.total ?? 0) > 0).toBe(
              true,
            );
            expect(
              queriedSchedulesPayload.data?.every(
                (schedule) =>
                  schedule.section?.code === facts.section.code &&
                  schedule.room?.jwId === facts.roomJwId &&
                  schedule.teachers?.some(
                    (teacher) => teacher.code === facts.teacher.code,
                  ) === true,
              ),
            ).toBe(true);
          }
          if (domain === "Exam") {
            const examsResult = await mcpClient.callTool({
              name: "catalog_section_exam_list",
              arguments: {
                sectionJwId: facts.section.jwId,
                locale: "zh-cn",
              },
            });
            const examsPayload = parseTextContent(examsResult) as {
              found?: boolean;
              section?: { jwId?: number };
              exams?: Array<{ id?: number }>;
            };
            expect(examsPayload.found).toBe(true);
            expect(examsPayload.section?.jwId).toBe(facts.section.jwId);
            expect((examsPayload.exams?.length ?? 0) > 0).toBe(true);
          }
          if (domain === "Catalog") {
            const matchSectionCodesResult = await mcpClient.callTool({
              name: "catalog_section_match_preview",
              arguments: {
                codes: [facts.section.code, "NOT-EXIST-CODE"],
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
              facts.section.code,
            );
            expect(matchSectionCodesPayload.unmatchedCodes).toContain(
              "NOT-EXIST-CODE",
            );

            const fuzzySectionCode = facts.section.code.replace(/\.\d+$/, ".0");
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
              facts.section.code,
            ]);

            const missingSectionResult = await mcpClient.callTool({
              name: "catalog_section_get",
              arguments: {
                jwId: 999999999,
                locale: "zh-cn",
              },
            });
            const missingSectionPayload = parseTextContent(
              missingSectionResult,
            ) as {
              found?: boolean;
              message?: string;
            };
            expect(missingSectionPayload.found).toBe(false);
            expect(missingSectionPayload.message).toContain("999999999");
          }
          return {
            async verifyState() {
              expect(await readCatalog()).toEqual(expectedCatalog);
            },
          };
        },
      );
    });
  }
});
