import { expect, test } from "@playwright/test";
import { DEV_SEED, DEV_SEED_ANCHOR } from "../../../../utils/dev-seed";
import {
  type BusPreference,
  createAuthenticatedMcpClient,
  getCurrentSubscriptionSectionIds,
  getSeedSectionId,
  parseTextContent,
  replaceCalendarSubscription,
  saveBusPreference,
} from "./helpers";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("OAuth PKCE token 可连接 /api/mcp 并调用全部种子工具", async ({
    page,
    request,
  }) => {
    const mcp = await createAuthenticatedMcpClient(page, request);
    try {
      const mcpClient = mcp.client;
      const currentUser = mcp.currentUser;
      const originalBusPreferenceResponse = await page.request.get(
        "/api/bus/preferences",
      );
      expect(originalBusPreferenceResponse.status()).toBe(200);
      const originalBusPreference = (
        (await originalBusPreferenceResponse.json()) as {
          preference?: BusPreference;
        }
      ).preference;

      const metadataResponse = await request.get(
        "/.well-known/oauth-authorization-server",
      );
      expect(metadataResponse.status()).toBe(200);

      const originalSectionIds = await getCurrentSubscriptionSectionIds(
        page.request,
      );
      const seedSectionId = await getSeedSectionId(page.request);

      let createdHomeworkId: string | null = null;
      try {
        await saveBusPreference(page.request, {
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 4,
          showDepartedTrips: true,
        });

        await replaceCalendarSubscription(page.request, [seedSectionId]);

        const tools = await mcpClient.listTools();
        expect(tools.tools.map((tool) => tool.name)).toEqual(
          expect.arrayContaining([
            "get_my_profile",
            "get_public_user_profile",
            "list_my_todos",
            "create_my_todo",
            "update_my_todo",
            "delete_my_todo",
            "get_my_dashboard",
            "get_next_class",
            "get_upcoming_deadlines",
            "list_my_homeworks",
            "set_my_homework_completion",
            "list_my_uploads",
            "rename_my_upload",
            "delete_my_upload",
            "list_my_schedules",
            "list_my_exams",
            "get_my_overview",
            "get_my_7days_timeline",
            "search_courses",
            "match_section_codes",
            "get_my_calendar_subscription",
            "subscribe_my_sections_by_codes",
            "get_section_by_jw_id",
            "list_homeworks_by_section",
            "create_homework_on_section",
            "update_homework_on_section",
            "delete_homework_on_section",
            "list_schedules_by_section",
            "list_exams_by_section",
            "query_bus_timetable",
            "list_bus_routes",
            "get_bus_route_timetable",
            "search_bus_routes",
            "get_next_buses",
            "list_comments",
            "get_comment_thread",
            "create_comment",
            "update_own_comment",
            "delete_own_comment",
            "add_comment_reaction",
            "remove_comment_reaction",
          ]),
        );
        expect(tools.tools.map((tool) => tool.name)).not.toEqual(
          expect.arrayContaining(["set_comment_reaction"]),
        );
        for (const name of [
          "create_homework_on_section",
          "update_homework_on_section",
        ]) {
          const description =
            tools.tools.find((tool) => tool.name === name)?.description ?? "";
          expect(description).toContain("Advisory style guide only");
          expect(description).toContain(
            "never reject a request for formatting",
          );
          expect(description).toContain("第{N}次作业");
          expect(description).toContain("{主题}作业");
          expect(description).toContain("第一章作业");
          expect(description).toMatch(/题目.*提交方式.*提交地址.*备注/);
        }

        const profileResult = await mcpClient.callTool({
          name: "get_my_profile",
          arguments: {},
        });
        const profile = parseTextContent(profileResult) as {
          id?: string;
          email?: string | null;
          name?: string | null;
          username?: string | null;
          isAdmin?: boolean;
          createdAt?: string;
          updatedAt?: string;
        };
        expect(profile.id).toBe(currentUser.id);
        expect(typeof profile.email).toBe("string");
        expect(profile.name).toBe(DEV_SEED.debugName);
        expect(profile.username).toBe(currentUser.username ?? null);
        expect(profile.isAdmin).toBe(false);
        expect(typeof profile.createdAt).toBe("string");
        expect(profile.createdAt).toMatch(/\+08:00$/);
        expect(typeof profile.updatedAt).toBe("string");
        expect(profile.updatedAt).toMatch(/\+08:00$/);

        const publicProfileResult = await mcpClient.callTool({
          name: "get_public_user_profile",
          arguments: { username: DEV_SEED.debugUsername, mode: "full" },
        });
        const publicProfile = parseTextContent(publicProfileResult) as {
          found?: boolean;
          user?: {
            id?: string;
            name?: string | null;
            username?: string | null;
            _count?: { comments?: number; uploads?: number };
          };
          sectionCount?: number;
          weeks?: unknown[];
          totalContributions?: number;
        };
        expect(publicProfile.found).toBe(true);
        expect(publicProfile.user?.id).toBe(currentUser.id);
        expect(publicProfile.user?.name).toBe(DEV_SEED.debugName);
        expect(publicProfile.user?.username).toBe(DEV_SEED.debugUsername);
        expect(typeof publicProfile.sectionCount).toBe("number");
        expect(typeof publicProfile.totalContributions).toBe("number");
        expect(Array.isArray(publicProfile.weeks)).toBe(true);
        expect(typeof publicProfile.user?._count?.comments).toBe("number");
        expect(typeof publicProfile.user?._count?.uploads).toBe("number");

        const todosResult = await mcpClient.callTool({
          name: "list_my_todos",
          arguments: {},
        });
        const todosPayload = parseTextContent(todosResult) as {
          counts?: {
            incomplete?: number;
            completed?: number;
            overdue?: number;
          };
          todos?: Array<{ title?: string; completed?: boolean }>;
        };
        expect(typeof todosPayload.counts?.incomplete).toBe("number");
        expect(typeof todosPayload.counts?.completed).toBe("number");
        expect(
          todosPayload.todos?.some(
            (todo) =>
              todo.title === DEV_SEED.todos.dueTodayTitle &&
              todo.completed === false,
          ),
        ).toBe(true);
        expect(
          todosPayload.todos?.some(
            (todo) =>
              todo.title === DEV_SEED.todos.completedTitle &&
              todo.completed === true,
          ),
        ).toBe(false);

        const coursesResult = await mcpClient.callTool({
          name: "search_courses",
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
          name: "get_section_by_jw_id",
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
          name: "search_sections",
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

        const homeworksResult = await mcpClient.callTool({
          name: "list_homeworks_by_section",
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

        const schedulesResult = await mcpClient.callTool({
          name: "list_schedules_by_section",
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
          name: "query_schedules",
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
          name: "list_exams_by_section",
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

        const myHomeworksResult = await mcpClient.callTool({
          name: "list_my_homeworks",
          arguments: {
            completed: false,
            limit: 30,
            locale: "zh-cn",
          },
        });
        const myHomeworksPayload = parseTextContent(myHomeworksResult) as {
          homeworks?: Array<{
            id?: string;
            title?: string;
            completion?: { completedAt?: string } | null;
            commentCount?: number;
          }>;
        };
        expect(
          myHomeworksPayload.homeworks?.some(
            (homework) => homework.title === DEV_SEED.homeworks.title,
          ),
        ).toBe(true);
        expect(
          myHomeworksPayload.homeworks?.some(
            (homework) =>
              typeof homework.commentCount === "number" &&
              Object.hasOwn(homework, "completion"),
          ),
        ).toBe(true);
        const firstHomeworkId = myHomeworksPayload.homeworks?.[0]?.id;
        expect(typeof firstHomeworkId).toBe("string");

        const setCompletionTrueResult = await mcpClient.callTool({
          name: "set_my_homework_completion",
          arguments: {
            homeworkId: firstHomeworkId,
            completed: true,
          },
        });
        const setCompletionTruePayload = parseTextContent(
          setCompletionTrueResult,
        ) as {
          success?: boolean;
          completion?: { completed?: boolean };
        };
        expect(setCompletionTruePayload.success).toBe(true);
        expect(setCompletionTruePayload.completion?.completed).toBe(true);

        const setCompletionFalseResult = await mcpClient.callTool({
          name: "set_my_homework_completion",
          arguments: {
            homeworkId: firstHomeworkId,
            completed: false,
          },
        });
        const setCompletionFalsePayload = parseTextContent(
          setCompletionFalseResult,
        ) as {
          success?: boolean;
          completion?: { completed?: boolean };
        };
        expect(setCompletionFalsePayload.success).toBe(true);
        expect(setCompletionFalsePayload.completion?.completed).toBe(false);

        const mySchedulesResult = await mcpClient.callTool({
          name: "list_my_schedules",
          arguments: {
            limit: 30,
            locale: "zh-cn",
          },
        });
        const mySchedulesPayload = parseTextContent(mySchedulesResult) as {
          schedules?: Array<{ id?: number }>;
        };
        expect((mySchedulesPayload.schedules?.length ?? 0) > 0).toBe(true);

        const myExamsResult = await mcpClient.callTool({
          name: "list_my_exams",
          arguments: {
            includeDateUnknown: true,
            limit: 30,
            locale: "zh-cn",
          },
        });
        const myExamsPayload = parseTextContent(myExamsResult) as {
          exams?: Array<{ id?: number }>;
        };
        expect((myExamsPayload.exams?.length ?? 0) > 0).toBe(true);

        const overviewResult = await mcpClient.callTool({
          name: "get_my_overview",
          arguments: {
            limit: 2,
            locale: "zh-cn",
          },
        });
        const overviewPayload = parseTextContent(overviewResult) as {
          overview?: {
            pendingTodosCount?: number;
            pendingHomeworksCount?: number;
            todaySchedulesCount?: number;
            upcomingExamsCount?: number;
          };
          samples?: {
            dueTodos?: Array<{ id?: string }>;
            dueHomeworks?: Array<{ id?: string }>;
            upcomingExams?: Array<{ id?: number }>;
          };
        };
        expect(typeof overviewPayload.overview?.pendingTodosCount).toBe(
          "number",
        );
        expect(typeof overviewPayload.overview?.pendingHomeworksCount).toBe(
          "number",
        );
        expect(typeof overviewPayload.overview?.todaySchedulesCount).toBe(
          "number",
        );
        expect(typeof overviewPayload.overview?.upcomingExamsCount).toBe(
          "number",
        );
        expect((overviewPayload.samples?.dueTodos?.length ?? 0) <= 2).toBe(
          true,
        );
        expect((overviewPayload.samples?.dueHomeworks?.length ?? 0) <= 2).toBe(
          true,
        );
        expect((overviewPayload.samples?.upcomingExams?.length ?? 0) <= 2).toBe(
          true,
        );
        const overviewSummaryResult = await mcpClient.callTool({
          name: "get_my_overview",
          arguments: {
            limit: 2,
            locale: "zh-cn",
            mode: "summary",
          },
        });
        const overviewSummaryPayload = parseTextContent(
          overviewSummaryResult,
        ) as {
          samples?: {
            dueTodos?: Array<{ id?: string }>;
            dueHomeworks?: Array<{ id?: string }>;
            upcomingExams?: Array<{ id?: number }>;
          };
        };
        expect(overviewSummaryPayload.samples).toEqual(overviewPayload.samples);

        const dashboardResult = await mcpClient.callTool({
          name: "get_my_dashboard",
          arguments: {
            locale: "zh-cn",
          },
        });
        const dashboardPayload = parseTextContent(dashboardResult) as {
          currentSemester?: { code?: string | null };
          subscriptions?: {
            currentSemesterCount?: number;
            currentSemesterSectionsTotal?: number;
            currentSemesterSections?: Array<{ jwId?: number }>;
          };
          nextClass?: {
            payload?: { scheduleGroup?: unknown; roomType?: unknown };
          };
          upcomingDeadlines?: {
            total?: number;
            items?: Array<{ type?: string }>;
          };
          todos?: { incompleteCount?: number; items?: Array<{ id?: string }> };
          bus?: {
            nextDeparture?: { routeId?: number | null } | null;
            departures?: Array<{ routeId?: number | null }>;
          };
        };
        expect(dashboardPayload.currentSemester?.code).toBeDefined();
        expect(
          typeof dashboardPayload.subscriptions?.currentSemesterCount,
        ).toBe("number");
        expect(
          dashboardPayload.subscriptions?.currentSemesterSectionsTotal,
        ).toBeGreaterThan(0);
        if (dashboardPayload.nextClass?.payload) {
          expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
            "scheduleGroup",
          );
          expect(dashboardPayload.nextClass.payload).not.toHaveProperty(
            "roomType",
          );
        }
        expect(typeof dashboardPayload.todos?.incompleteCount).toBe("number");
        expect(typeof dashboardPayload.upcomingDeadlines?.total).toBe("number");
        const nextDeparture = dashboardPayload.bus?.nextDeparture ?? null;
        if (nextDeparture) {
          expect(typeof nextDeparture.routeId).toBe("number");
        } else {
          expect(nextDeparture).toBeNull();
        }
        const dashboardSummaryResult = await mcpClient.callTool({
          name: "get_my_dashboard",
          arguments: {
            locale: "zh-cn",
            mode: "summary",
          },
        });
        const dashboardSummaryPayload = parseTextContent(
          dashboardSummaryResult,
        ) as {
          subscriptions?: {
            currentSemesterSections?: unknown;
            currentSemesterSectionsTotal?: number;
          };
          upcomingDeadlines?: {
            total?: number;
            items?: Array<{ type?: string }>;
          };
          todos?: { incompleteCount?: number; items?: unknown };
        };
        expect(
          dashboardSummaryPayload.subscriptions?.currentSemesterSections,
        ).toEqual(dashboardPayload.subscriptions?.currentSemesterSections);
        expect(dashboardSummaryPayload.upcomingDeadlines?.items).toEqual(
          dashboardPayload.upcomingDeadlines?.items,
        );
        expect(dashboardSummaryPayload.todos?.items).toEqual(
          dashboardPayload.todos?.items,
        );

        const nextClassResult = await mcpClient.callTool({
          name: "get_next_class",
          arguments: {
            locale: "zh-cn",
          },
        });
        const nextClassPayload = parseTextContent(nextClassResult) as {
          found?: boolean;
          nextClass?: { type?: string; at?: string | null };
        };
        expect(typeof nextClassPayload.found).toBe("boolean");
        if (nextClassPayload.found) {
          expect(nextClassPayload.nextClass?.type).toBe("schedule");
        }

        const deadlinesResult = await mcpClient.callTool({
          name: "get_upcoming_deadlines",
          arguments: {
            locale: "zh-cn",
            dayLimit: 7,
          },
        });
        const deadlinesPayload = parseTextContent(deadlinesResult) as {
          total?: number;
          deadlines?: Array<{ type?: string }>;
        };
        expect(typeof deadlinesPayload.total).toBe("number");
        expect(
          deadlinesPayload.deadlines?.every((event) =>
            ["homework_due", "exam", "todo_due"].includes(event.type ?? ""),
          ),
        ).toBe(true);

        const timelineResult = await mcpClient.callTool({
          name: "get_my_7days_timeline",
          arguments: {
            locale: "zh-cn",
            atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
          },
        });
        const timelinePayload = parseTextContent(timelineResult) as {
          total?: number;
          range?: { from?: string; to?: string };
          events?: Array<{ type?: string; at?: string | null }>;
        };
        expect(typeof timelinePayload.total).toBe("number");
        expect(timelinePayload.range?.from).toMatch(/\+08:00$/);
        expect(timelinePayload.range?.to).toMatch(/\+08:00$/);
        expect((timelinePayload.events?.length ?? 0) > 0).toBe(true);
        expect(
          timelinePayload.events?.some(
            (event) =>
              typeof event.at === "string" && /\+08:00$/.test(event.at),
          ),
        ).toBe(true);
        expect(
          timelinePayload.events?.some((event) =>
            ["schedule", "homework_due", "exam", "todo_due"].includes(
              event.type ?? "",
            ),
          ),
        ).toBe(true);
        const timelineSummaryResult = await mcpClient.callTool({
          name: "get_my_7days_timeline",
          arguments: {
            locale: "zh-cn",
            atTime: DEV_SEED_ANCHOR.startOfDayAtTime,
            mode: "summary",
          },
        });
        const timelineSummaryPayload = parseTextContent(
          timelineSummaryResult,
        ) as {
          total?: number;
          events?: Array<{ type?: string; at?: string | null }>;
        };
        expect(timelineSummaryPayload.events).toEqual(timelinePayload.events);
        expect(timelineSummaryPayload.total).toBe(timelinePayload.total);

        const calendarEventsResult = await mcpClient.callTool({
          name: "list_my_calendar_events",
          arguments: {
            dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
            dateTo: "2026-05-10T23:59:59+08:00",
            locale: "zh-cn",
          },
        });
        const calendarEventsPayload = parseTextContent(
          calendarEventsResult,
        ) as {
          events?: Array<{ type?: string; at?: string | null }>;
        };
        expect((calendarEventsPayload.events?.length ?? 0) > 0).toBe(true);

        const calendarEventsSummaryResult = await mcpClient.callTool({
          name: "list_my_calendar_events",
          arguments: {
            dateFrom: DEV_SEED_ANCHOR.startOfDayAtTime,
            dateTo: "2026-05-10T23:59:59+08:00",
            locale: "zh-cn",
            mode: "summary",
          },
        });
        const calendarEventsSummaryPayload = parseTextContent(
          calendarEventsSummaryResult,
        ) as {
          events?: Array<{ type?: string; at?: string | null }>;
        };
        expect(calendarEventsSummaryPayload.events).toEqual(
          calendarEventsPayload.events,
        );

        const matchSectionCodesResult = await mcpClient.callTool({
          name: "match_section_codes",
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
          name: "match_section_codes",
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

        let busResult:
          | Awaited<ReturnType<typeof mcpClient.callTool>>
          | undefined;
        let busPayload:
          | {
              fetchedAt?: string;
              version?: { title?: string | null };
              counts?: {
                routes?: number;
                weekdayTrips?: number;
                weekendTrips?: number;
              };
              routes?: Array<{ id?: number | null }>;
              nextDepartures?: Array<{
                routeId?: number;
                departureTime?: string | null;
              }>;
              trips?: Array<{
                dayType?: string;
                stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
              }>;
              preferences?: {
                preferredOriginCampusId?: number | null;
                preferredDestinationCampusId?: number | null;
                showDepartedTrips?: boolean;
              } | null;
            }
          | undefined;
        await expect(async () => {
          const preferenceResponse = await page.request.post(
            "/api/bus/preferences",
            {
              data: {
                preferredOriginCampusId: 1,
                preferredDestinationCampusId: 4,
                showDepartedTrips: true,
              },
            },
          );
          expect(preferenceResponse.status()).toBe(200);
          busResult = await mcpClient.callTool({
            name: "query_bus_timetable",
            arguments: {
              locale: "zh-cn",
            },
          });
          busPayload = parseTextContent(busResult) as typeof busPayload;
          expect(typeof busPayload?.fetchedAt).toBe("string");
          expect(busPayload?.version?.title).toContain(
            DEV_SEED.bus.versionTitle,
          );
          expect(typeof busPayload?.counts?.routes).toBe("number");
          expect(
            busPayload?.routes?.some(
              (route) => route.id === DEV_SEED.bus.routeId,
            ),
          ).toBe(true);
          expect(busPayload?.trips).toBeUndefined();
          expect(busPayload?.preferences?.preferredOriginCampusId).toBe(1);
          expect(busPayload?.preferences?.preferredDestinationCampusId).toBe(4);
          expect(busPayload?.preferences?.showDepartedTrips).toBe(true);
          expect((busPayload?.nextDepartures?.length ?? 0) > 0).toBe(true);
        }).toPass({
          timeout: 10_000,
          intervals: [250, 500, 1_000],
        });
        if (!busPayload) {
          throw new Error("query_bus_timetable returned no payload");
        }

        const busFullResult = await mcpClient.callTool({
          name: "query_bus_timetable",
          arguments: {
            locale: "zh-cn",
            mode: "full",
          },
        });
        const busFullPayload = parseTextContent(busFullResult) as {
          routes?: Array<{ id?: number | null }>;
          trips?: Array<{
            dayType?: string;
            stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
          }>;
        };
        expect(
          busFullPayload.routes?.some(
            (route) => route.id === DEV_SEED.bus.routeId,
          ),
        ).toBe(true);
        expect(
          busFullPayload.trips?.some(
            (trip) => trip.dayType === "weekday" || trip.dayType === "weekend",
          ),
        ).toBe(true);
        expect(
          busFullPayload.trips?.some(
            (trip) =>
              Array.isArray(trip.stopTimes) &&
              trip.stopTimes.some(
                (stopTime) => typeof stopTime.stopOrder === "number",
              ),
          ),
        ).toBe(true);

        const busSummaryResult = await mcpClient.callTool({
          name: "query_bus_timetable",
          arguments: {
            locale: "zh-cn",
            mode: "summary",
          },
        });
        const busSummaryPayload = parseTextContent(busSummaryResult) as {
          counts?: {
            routes?: number;
            weekdayTrips?: number;
            weekendTrips?: number;
          };
          nextDepartures?: Array<{
            routeId?: number;
            departureTime?: string | null;
          }>;
          nextDeparturesMessage?: string | null;
          campuses?: unknown[];
          routes?: unknown[];
          trips?: unknown;
        };
        expect(typeof busSummaryPayload.counts?.routes).toBe("number");
        expect(typeof busSummaryPayload.counts?.weekdayTrips).toBe("number");
        expect(typeof busSummaryPayload.counts?.weekendTrips).toBe("number");
        expect((busSummaryPayload.nextDepartures?.length ?? 0) > 0).toBe(true);
        expect(Array.isArray(busSummaryPayload.campuses)).toBe(true);
        expect(Array.isArray(busSummaryPayload.routes)).toBe(true);
        expect(busSummaryPayload.trips).toBeUndefined();
        expect(busResult).toBeDefined();
        if (busSummaryPayload.nextDepartures?.length === 0) {
          expect(typeof busSummaryPayload.nextDeparturesMessage).toBe("string");
        }

        // list_bus_routes — lightweight route catalog
        const listRoutesResult = await mcpClient.callTool({
          name: "list_bus_routes",
          arguments: { locale: "zh-cn" },
        });
        const listRoutesPayload = parseTextContent(listRoutesResult) as {
          routes?: Array<{
            id?: number;
            stops?: Array<{ campusId?: number }>;
          }>;
          campuses?: Array<{ id?: number }>;
        };
        expect(Array.isArray(listRoutesPayload.routes)).toBe(true);
        expect(listRoutesPayload.routes?.length).toBeGreaterThan(0);
        expect(Array.isArray(listRoutesPayload.campuses)).toBe(true);
        expect(
          listRoutesPayload.routes?.some((r) => r.id === DEV_SEED.bus.routeId),
        ).toBe(true);
        const queryRouteIds = new Set(
          (busPayload.routes ?? [])
            .map((route) => route.id)
            .filter(
              (routeId): routeId is number => typeof routeId === "number",
            ),
        );
        const listedRouteIds = new Set(
          (listRoutesPayload.routes ?? [])
            .map((route) => route.id)
            .filter(
              (routeId): routeId is number => typeof routeId === "number",
            ),
        );
        expect(listedRouteIds.size).toBeGreaterThan(0);
        expect(
          [...listedRouteIds].every((routeId) => queryRouteIds.has(routeId)),
        ).toBe(true);

        // get_bus_route_timetable — full weekday+weekend for one route
        const timetableResult = await mcpClient.callTool({
          name: "get_bus_route_timetable",
          arguments: {
            routeId: DEV_SEED.bus.routeId,
            locale: "zh-cn",
          },
        });
        const timetablePayload = parseTextContent(timetableResult) as {
          route?: { id?: number };
          weekday?: Array<{
            position?: number;
            stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
          }>;
          weekend?: Array<{
            position?: number;
            stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
          }>;
          alternateRoutes?: Array<{ id?: number }>;
        };
        expect(timetablePayload.route?.id).toBe(DEV_SEED.bus.routeId);
        expect(Array.isArray(timetablePayload.weekday)).toBe(true);
        expect(Array.isArray(timetablePayload.weekend)).toBe(true);
        expect(Array.isArray(timetablePayload.alternateRoutes)).toBe(true);
        expect(
          timetablePayload.weekday?.some(
            (trip) =>
              Array.isArray(trip.stopTimes) &&
              trip.stopTimes.some(
                (stopTime) => typeof stopTime.stopOrder === "number",
              ),
          ),
        ).toBe(true);

        const searchRoutesResult = await mcpClient.callTool({
          name: "search_bus_routes",
          arguments: {
            locale: "zh-cn",
            originCampusId: DEV_SEED.bus.originCampusId,
            destinationCampusId: DEV_SEED.bus.destinationCampusId,
          },
        });
        const searchRoutesPayload = parseTextContent(searchRoutesResult) as {
          total?: number;
          routes?: Array<{ id?: number }>;
        };
        expect(searchRoutesPayload.total).toBeGreaterThan(0);
        expect(
          searchRoutesPayload.routes?.some(
            (route) => route.id === DEV_SEED.bus.recommendedRouteId,
          ),
        ).toBe(true);

        const nextBusesResult = await mcpClient.callTool({
          name: "get_next_buses",
          arguments: {
            locale: "zh-cn",
            originCampusId: DEV_SEED.bus.originCampusId,
            destinationCampusId: DEV_SEED.bus.destinationCampusId,
          },
        });
        const nextBusesPayload = parseTextContent(nextBusesResult) as {
          totalRoutes?: number;
          departures?: Array<{
            routeId?: number;
            departureTime?: string | null;
            originCampus?: unknown;
            destinationCampus?: unknown;
          }>;
          message?: string | null;
          nextAvailableDeparture?: {
            routeId?: number;
            departureTime?: string | null;
          } | null;
        };
        expect(nextBusesPayload.totalRoutes).toBeGreaterThan(0);
        if ((nextBusesPayload.departures?.length ?? 0) > 0) {
          expect(
            nextBusesPayload.departures?.every(
              (departure) =>
                typeof departure.routeId === "number" &&
                typeof departure.departureTime === "string" &&
                !Object.hasOwn(departure, "originCampus") &&
                !Object.hasOwn(departure, "destinationCampus"),
            ),
          ).toBe(true);
        } else {
          expect(typeof nextBusesPayload.message).toBe("string");
          if (nextBusesPayload.nextAvailableDeparture) {
            expect(typeof nextBusesPayload.nextAvailableDeparture.routeId).toBe(
              "number",
            );
          }
        }

        // get_bus_route_timetable — invalid route returns error message
        const invalidTimetableResult = await mcpClient.callTool({
          name: "get_bus_route_timetable",
          arguments: { routeId: 99999, locale: "zh-cn" },
        });
        const invalidPayload = parseTextContent(invalidTimetableResult) as {
          hasData?: boolean;
          message?: string;
        };
        expect(invalidPayload.hasData).toBe(false);

        const todoTitle = `[MCP-E2E-TODO] ${Date.now()}`;
        const createTodoResult = await mcpClient.callTool({
          name: "create_my_todo",
          arguments: {
            title: todoTitle,
            content: "todo created by mcp e2e",
            priority: "medium",
            dueAt: new Date().toISOString(),
          },
        });
        const createTodoPayload = parseTextContent(createTodoResult) as {
          success?: boolean;
          id?: string;
        };
        expect(createTodoPayload.success).toBe(true);
        expect(typeof createTodoPayload.id).toBe("string");

        const updateTodoResult = await mcpClient.callTool({
          name: "update_my_todo",
          arguments: {
            id: createTodoPayload.id,
            title: `${todoTitle}-updated`,
            completed: true,
          },
        });
        const updateTodoPayload = parseTextContent(updateTodoResult) as {
          success?: boolean;
        };
        expect(updateTodoPayload.success).toBe(true);

        const deleteTodoResult = await mcpClient.callTool({
          name: "delete_my_todo",
          arguments: {
            id: createTodoPayload.id,
          },
        });
        const deleteTodoPayload = parseTextContent(deleteTodoResult) as {
          success?: boolean;
        };
        expect(deleteTodoPayload.success).toBe(true);

        const homeworkTitle = `[MCP-E2E-HW] ${Date.now()}`;
        const createHomeworkResult = await mcpClient.callTool({
          name: "create_homework_on_section",
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
        createdHomeworkId = createHomeworkPayload.id ?? null;
        expect(createHomeworkPayload.homework?.id).toBe(
          createHomeworkPayload.id,
        );
        expect(createHomeworkPayload.homework?.title).toBe(homeworkTitle);
        expect(createHomeworkPayload.homework?.section?.jwId).toBe(
          DEV_SEED.section.jwId,
        );
        expect(typeof createHomeworkPayload.homework?.commentCount).toBe(
          "number",
        );

        const updateHomeworkResult = await mcpClient.callTool({
          name: "update_homework_on_section",
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
          name: "update_homework_on_section",
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
          name: "update_homework_on_section",
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
          name: "delete_homework_on_section",
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
        createdHomeworkId = null;

        const calendarSubscriptionResult = await mcpClient.callTool({
          name: "get_my_calendar_subscription",
          arguments: {
            locale: "zh-cn",
          },
        });
        const calendarSubscriptionPayload = parseTextContent(
          calendarSubscriptionResult,
        ) as {
          success?: boolean;
          subscription?: {
            userId?: string;
            currentSemesterSections?: Array<{ id?: number }>;
            sections?: Array<{ id?: number }>;
            calendarPath?: string;
          };
        };
        expect(calendarSubscriptionPayload.success).toBe(true);
        expect(calendarSubscriptionPayload.subscription?.userId).toBe(
          currentUser.id,
        );
        expect(
          (calendarSubscriptionPayload.subscription?.currentSemesterSections
            ?.length ?? 0) > 0,
        ).toBe(true);
        expect(
          calendarSubscriptionPayload.subscription?.sections,
        ).toBeUndefined();
        expect(
          calendarSubscriptionPayload.subscription?.calendarPath,
        ).toContain("/api/users/");

        const calendarSubscriptionSummaryResult = await mcpClient.callTool({
          name: "get_my_calendar_subscription",
          arguments: {
            locale: "zh-cn",
            mode: "summary",
          },
        });
        const calendarSubscriptionSummaryPayload = parseTextContent(
          calendarSubscriptionSummaryResult,
        ) as {
          subscription?: {
            sectionCount?: number;
            currentSemesterSectionCount?: number;
            currentSemesterSections?: unknown[];
            calendarPath?: string;
          };
        };
        expect(
          calendarSubscriptionSummaryPayload.subscription?.sectionCount,
        ).toBeGreaterThan(0);
        expect(
          Array.isArray(
            calendarSubscriptionSummaryPayload.subscription
              ?.currentSemesterSections,
          ),
        ).toBe(true);
        expect(
          calendarSubscriptionSummaryPayload.subscription?.calendarPath,
        ).toContain("[redacted]");

        const subscribeResult = await mcpClient.callTool({
          name: "subscribe_my_sections_by_codes",
          arguments: {
            codes: [DEV_SEED.section.code],
            locale: "zh-cn",
          },
        });
        const subscribePayload = parseTextContent(subscribeResult) as {
          success?: boolean;
          matchedCodes?: string[];
          subscription?: {
            sectionCount?: number;
            currentSemesterSections?: unknown;
            sections?: unknown;
          } | null;
        };
        expect(subscribePayload.success).toBe(true);
        expect(subscribePayload.matchedCodes).toContain(DEV_SEED.section.code);
        expect(typeof subscribePayload.subscription?.sectionCount).toBe(
          "number",
        );
        expect(
          subscribePayload.subscription?.currentSemesterSections,
        ).toBeUndefined();
        expect(subscribePayload.subscription?.sections).toBeUndefined();

        const missingSectionResult = await mcpClient.callTool({
          name: "get_section_by_jw_id",
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
      } finally {
        if (createdHomeworkId) {
          await page.request.delete(`/api/homeworks/${createdHomeworkId}`);
        }
        await replaceCalendarSubscription(page.request, originalSectionIds);
        await saveBusPreference(page.request, originalBusPreference ?? {});
      }
    } finally {
      await mcp.close();
    }
  });
});
