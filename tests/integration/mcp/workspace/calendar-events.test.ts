import { describe } from "vitest";
import { isolatedMcpTest } from "../_harness/isolated-context";

const calendarDay = "2026-04-29";
const throughDay = "2026-05-10";
const afterThroughDay = "2026-05-11";
const homeworkDay = "2026-05-02";

const toolTest = isolatedMcpTest.extend(
  "calendar",
  async ({
    mcpWorkflow,
    signal,
    mcpActor,
    mcpSection,
    mcpSchedules,
    isolatedDatabase,
  }) => {
    const setupResult = await mcpWorkflow.run(async () => {
      const exam = await isolatedDatabase.owner.$transaction(async (db) => {
        await db.userSectionSubscription.create({
          data: { userId: mcpActor.userId, sectionId: mcpSection.id },
        });
        return db.exam.create({
          data: {
            jwId: 1,
            sectionId: mcpSection.id,
            examDate: new Date("2026-04-30T00:00:00.000Z"),
            startTime: 900,
            endTime: 1100,
          },
          select: { id: true, jwId: true },
        });
      });
      return { section: mcpSection, schedules: mcpSchedules, exam };
    });
    signal.throwIfAborted();
    return setupResult;
  },
);

const fullSectionTest = toolTest.extend(
  "sectionWithLabels",
  async ({ mcpWorkflow, calendar, isolatedDatabase, signal }) => {
    const section = await mcpWorkflow.run(async () => {
      const label = (nameCn: string) => ({ create: { nameCn } });
      return await isolatedDatabase.owner.section.update({
        where: { id: calendar.section.id },
        data: {
          examMode: label("闭卷"),
          teachLanguage: label("中文"),
          course: {
            update: {
              category: label("类别"),
              classType: label("课型"),
              classify: label("分类"),
              educationLevel: label("培养层次"),
              gradation: label("课程层次"),
              type: label("类型"),
            },
          },
        },
        include: { course: true },
      });
    });
    signal.throwIfAborted();
    return section;
  },
);

for (const kind of ["schedule", "exam"] as const) {
  fullSectionTest(
    `workspace_${kind}_list preserves its declared full section projection`,
    { tags: [kind === "schedule" ? "@Schedule/MCP" : "@Exam/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor,
      calendar,
      sectionWithLabels: section,
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const result = await mcpActor.client.call<
          Record<string, Array<{ id: number; section: { course: unknown } }>>
        >(`workspace_${kind}_list`, {
          dateFrom: calendarDay,
          dateTo: throughDay,
          mode: "full",
          locale: "zh-cn",
        });
        const items = result[kind === "schedule" ? "schedules" : "exams"];
        expect(items.map((item) => item.id)).toEqual(
          kind === "schedule"
            ? calendar.schedules.slice(0, 2).map((meeting) => meeting.id)
            : [calendar.exam.id],
        );
        for (const item of items) {
          expect(item.section.course).toMatchObject({
            categoryId: section.course.categoryId,
            classTypeId: section.course.classTypeId,
            classifyId: section.course.classifyId,
            educationLevelId: section.course.educationLevelId,
            gradationId: section.course.gradationId,
            typeId: section.course.typeId,
          });
          if (kind === "exam") {
            expect(item.section).toMatchObject({
              examMode: { nameCn: "闭卷" },
              teachLanguage: { nameCn: "中文" },
              course: {
                category: { nameCn: "类别" },
                classType: { nameCn: "课型" },
                classify: { nameCn: "分类" },
                educationLevel: { nameCn: "培养层次" },
                gradation: { nameCn: "课程层次" },
                type: { nameCn: "类型" },
              },
            });
          } else {
            // The schedule DTO publishes the six IDs, not the label relations.
            expect(Object.keys(item.section.course as object).sort()).toEqual([
              "categoryId",
              "classTypeId",
              "classifyId",
              "code",
              "educationLevelId",
              "gradationId",
              "id",
              "jwId",
              "nameCn",
              "nameEn",
              "namePrimary",
              "nameSecondary",
              "typeId",
            ]);
          }
        }
      }),
  );
}

for (const tool of [
  "workspace_calendar_event_list",
  "workspace_calendar_timeline_get",
  "workspace_deadline_list",
] as const) {
  for (const mode of ["default", "full"] as const) {
    fullSectionTest(
      `${tool} preserves calendar section context in ${mode} mode`,
      { tags: ["@Calendar/MCP"] },
      async ({ mcpWorkflow, mcpActor, calendar, sectionWithLabels, expect }) =>
        mcpWorkflow.run(async () => {
          const result = await mcpActor.client.call<
            Record<
              string,
              Array<{
                type: string;
                payload: {
                  id: number;
                  section: { course: Record<string, unknown> };
                };
              }>
            >
          >(tool, {
            ...(tool === "workspace_calendar_event_list"
              ? { dateFrom: calendarDay, dateTo: throughDay }
              : { atTime: "2026-04-29T08:00:00+08:00" }),
            mode,
            locale: "zh-cn",
          });
          const events =
            result[tool === "workspace_deadline_list" ? "deadlines" : "events"];
          expect(events.map((event) => event.payload.id)).toEqual(
            tool === "workspace_deadline_list"
              ? [calendar.exam.id]
              : [
                  calendar.schedules[0].id,
                  calendar.exam.id,
                  calendar.schedules[1].id,
                ],
          );
          for (const event of events) {
            expect(event.payload.section).toMatchObject({
              id: sectionWithLabels.id,
              course: {
                jwId: sectionWithLabels.course.jwId,
                nameCn: "MCP 测试课程",
              },
            });
            if (mode === "full") {
              expect(event.payload.section).toMatchObject({
                examMode: { nameCn: "闭卷" },
                teachLanguage: { nameCn: "中文" },
                course: {
                  category: { nameCn: "类别" },
                  classType: { nameCn: "课型" },
                  classify: { nameCn: "分类" },
                  educationLevel: { nameCn: "培养层次" },
                  gradation: { nameCn: "课程层次" },
                  type: { nameCn: "类型" },
                },
              });
            } else {
              expect(event.payload.section).not.toHaveProperty("examMode");
              expect(event.payload.section).not.toHaveProperty("teachLanguage");
              for (const relation of [
                "category",
                "classType",
                "classify",
                "educationLevel",
                "gradation",
                "type",
              ])
                expect(event.payload.section.course).not.toHaveProperty(
                  relation,
                );
            }
          }
        }),
    );
  }
}

for (const tool of [
  "workspace_snapshot_get",
  "workspace_schedule_next",
] as const) {
  fullSectionTest(
    `${tool} retains full next-class lookup labels`,
    { tags: ["@Overview/MCP"] },
    async ({ mcpWorkflow, mcpActor, calendar, sectionWithLabels, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await mcpActor.client.call<{ nextClass: unknown }>(
          tool,
          {
            atTime: "2026-04-29T08:00:00+08:00",
            mode: "full",
            locale: "zh-cn",
          },
        );
        expect(result.nextClass).toMatchObject({
          type: "schedule",
          payload: {
            id: calendar.schedules[0].id,
            section: {
              id: sectionWithLabels.id,
              examMode: { nameCn: "闭卷" },
              teachLanguage: { nameCn: "中文" },
              course: {
                category: { nameCn: "类别" },
                classType: { nameCn: "课型" },
                classify: { nameCn: "分类" },
                educationLevel: { nameCn: "培养层次" },
                gradation: { nameCn: "课程层次" },
                type: { nameCn: "类型" },
              },
            },
          },
        });
      }),
  );
}

describe("flexDateInputSchema — 日期筛选工具接受裸 YYYY-MM-DD", () => {
  toolTest(
    "workspace_schedule_list 接受裸日期字符串（无时区偏移）",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, calendar, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          schedules?: Array<{
            id?: number;
            date?: string;
            endTime?: unknown;
            startTime?: unknown;
          }>;
        }>("workspace_schedule_list", {
          dateFrom: calendarDay, // bare date — would have been rejected by old dateTimeSchema
          dateTo: throughDay,
          limit: 20,
          locale: "zh-cn",
        });

        // Should not error, and the prepared schedules should be returned
        expect(Array.isArray(result.schedules)).toBe(true);
        expect((result.schedules?.length ?? 0) > 0).toBe(true);
        expect(typeof result.schedules?.[0]?.startTime).toBe("string");
        expect(typeof result.schedules?.[0]?.endTime).toBe("string");
        // Every date should fall within the requested window
        for (const schedule of result.schedules ?? []) {
          if (schedule.date) {
            expect(schedule.date >= calendarDay).toBe(true);
            expect(schedule.date <= afterThroughDay).toBe(true); // lte dateTo end-of-day
          }
        }

        expect(result.schedules?.map((item) => item.id).sort()).toEqual(
          calendar.schedules
            .slice(0, 2)
            .map((item) => item.id)
            .sort(),
        );
      }),
  );

  toolTest(
    "workspace_exam_list 接受裸日期字符串",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, calendar, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          exams?: Array<{ id?: number }>;
        }>("workspace_exam_list", {
          dateFrom: calendarDay,
          includeDateUnknown: false,
          limit: 20,
          locale: "zh-cn",
        });

        expect(Array.isArray(result.exams)).toBe(true);

        expect(result.exams?.map((item) => item.id)).toEqual([
          calendar.exam.id,
        ]);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 接受裸日期字符串",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, calendar, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string | number };
          }>;
        }>("workspace_calendar_event_list", {
          dateFrom: calendarDay,
          dateTo: throughDay,
          locale: "zh-cn",
        });

        expect(Array.isArray(result.events)).toBe(true);
        // Should include the prepared schedule events
        expect(
          (result.events ?? []).some((e) =>
            ["schedule", "homework_due", "exam", "todo_due"].includes(
              e.type ?? "",
            ),
          ),
        ).toBe(true);

        expect(
          result.events
            ?.filter((item) => item.type === "schedule")
            .map((item) => item.payload?.id)
            .sort(),
        ).toEqual(
          calendar.schedules
            .slice(0, 2)
            .map((item) => item.id)
            .sort(),
        );
      }),
  );

  toolTest(
    "workspace_calendar_event_list 将同日裸日期范围视为完整上海天时区日",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, calendar, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string | number };
          }>;
        }>("workspace_calendar_event_list", {
          dateFrom: calendarDay,
          dateTo: calendarDay,
          locale: "zh-cn",
        });

        expect(Array.isArray(result.events)).toBe(true);
        expect(
          (result.events ?? []).some(
            (event) =>
              event.type === "schedule" && event.at?.startsWith(calendarDay),
          ),
        ).toBe(true);

        expect(
          result.events
            ?.filter((item) => item.type === "schedule")
            .map((item) => item.payload?.id),
        ).toEqual([calendar.schedules[0]?.id]);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 遵守精确包含的 dateTo 边界",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const dueAt = `${homeworkDay}T21:00:00+08:00`;
        const homework = await db.homework.create({
          data: {
            title: "[integration-test] calendar dateTo boundary homework",
            sectionId: calendar.section.id,
            publishedAt: new Date(`${calendarDay}T00:00:00+08:00`),
            submissionStartAt: new Date(`${calendarDay}T00:00:00+08:00`),
            submissionDueAt: new Date(dueAt),
            createdById: isolated.userId,
            updatedById: isolated.userId,
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string | number };
          }>;
        }>("workspace_calendar_event_list", {
          dateFrom: dueAt,
          dateTo: dueAt,
          locale: "zh-cn",
        });
        expect(
          (result.events ?? []).some(
            (event) => event.type === "homework_due" && event.at === dueAt,
          ),
        ).toBe(true);

        expect(
          result.events
            ?.filter((item) => item.type === "homework_due")
            .map((item) => item.payload?.id),
        ).toEqual([homework.id]);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 在精确包含的 dateTo 边界包含 todo",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar: _calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const dueAt = `${calendarDay}T06:45:00+08:00`;
        const todo = await db.todo.create({
          data: {
            userId: isolated.userId,
            title: "[integration-test] inclusive todo dueAt",
            dueAt: new Date(dueAt),
          },
          select: { id: true },
        });

        const result = await isolated.client.call<{
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string };
          }>;
        }>("workspace_calendar_event_list", {
          dateFrom: dueAt,
          dateTo: dueAt,
          locale: "zh-cn",
        });
        expect(
          (result.events ?? []).some(
            (event) =>
              event.type === "todo_due" &&
              event.at === dueAt &&
              event.payload?.id === todo.id,
          ),
        ).toBe(true);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 包含与精确窗口重叠的定时事件",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const schedule = await db.schedule.findFirst({
          where: {
            section: { jwId: calendar.section.jwId },
            date: new Date(`${calendarDay}T00:00:00.000Z`),
          },
          select: { id: true, startTime: true, endTime: true },
          orderBy: { startTime: "asc" },
        });
        if (!schedule) {
          throw new Error(`Private schedule for ${calendarDay} not found`);
        }

        const windowStart = `${calendarDay}T08:45:00+08:00`;
        const windowEnd = `${calendarDay}T09:00:00+08:00`;
        const endsAt = new Date(`${calendarDay}T10:00:00+08:00`);
        expect(endsAt.getTime()).toBeGreaterThan(new Date(windowEnd).getTime());

        const result = await isolated.client.call<{
          events?: Array<{ type?: string; payload?: { id?: number } }>;
        }>("workspace_calendar_event_list", {
          dateFrom: windowStart,
          dateTo: windowEnd,
          locale: "zh-cn",
        });

        expect(
          (result.events ?? []).some(
            (event) =>
              event.type === "schedule" && event.payload?.id === schedule.id,
          ),
        ).toBe(true);

        expect(schedule).toMatchObject({ startTime: 830, endTime: 1000 });
      }),
  );

  toolTest(
    "workspace_calendar_event_list 为精确窗口放宽基于日期的查询",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const section = await db.section.findUnique({
          where: { jwId: calendar.section.jwId },
          select: { id: true },
        });
        if (!section) {
          throw new Error(`Private section ${calendar.section.jwId} not found`);
        }

        const jwId = calendar.section.jwId + 91;

        await db.exam.create({
          data: {
            jwId,
            sectionId: section.id,
            examDate: new Date(`${calendarDay}T00:00:00.000Z`),
            startTime: null,
            endTime: null,
          },
        });
        const result = await isolated.client.call<{
          events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
        }>("workspace_calendar_event_list", {
          dateFrom: `${calendarDay}T00:10:00+08:00`,
          dateTo: `${calendarDay}T00:30:00+08:00`,
          locale: "zh-cn",
        });
        expect(
          (result.events ?? []).some(
            (event) => event.type === "exam" && event.payload?.jwId === jwId,
          ),
        ).toBe(true);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 使无时间考试在当天保持可见",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const section = await db.section.findUnique({
          where: { jwId: calendar.section.jwId },
          select: { id: true },
        });
        if (!section) {
          throw new Error(`Private section ${calendar.section.jwId} not found`);
        }

        const jwId = calendar.section.jwId + 90;

        await db.exam.create({
          data: {
            jwId,
            sectionId: section.id,
            examDate: new Date(`${calendarDay}T00:00:00.000Z`),
            startTime: null,
            endTime: null,
          },
        });
        const result = await isolated.client.call<{
          events?: Array<{
            type?: string;
            at?: string;
            payload?: { id?: string | number };
          }>;
        }>("workspace_calendar_event_list", {
          dateFrom: `${calendarDay}T08:00:00+08:00`,
          dateTo: `${calendarDay}T09:00:00+08:00`,
          locale: "zh-cn",
        });
        expect(
          (result.events ?? []).some(
            (event) =>
              event.type === "exam" &&
              event.at === `${calendarDay}T00:00:00+08:00`,
          ),
        ).toBe(true);
      }),
  );

  toolTest(
    "workspace_calendar_event_list 对无 startTime 的考试尊重 endTime",
    { tags: ["@Calendar/MCP"] },
    async ({
      mcpWorkflow,
      mcpActor: isolated,
      calendar,
      isolatedDatabase: { owner: db },
      expect,
    }) =>
      mcpWorkflow.run(async () => {
        const section = await db.section.findUnique({
          where: { jwId: calendar.section.jwId },
          select: { id: true },
        });
        if (!section) {
          throw new Error(`Private section ${calendar.section.jwId} not found`);
        }

        const jwId = calendar.section.jwId + 92;

        await db.exam.create({
          data: {
            jwId,
            sectionId: section.id,
            examDate: new Date(`${calendarDay}T00:00:00.000Z`),
            startTime: null,
            endTime: 1200,
          },
        });
        const result = await isolated.client.call<{
          events?: Array<{ type?: string; payload?: { jwId?: number | null } }>;
        }>("workspace_calendar_event_list", {
          dateFrom: `${calendarDay}T13:00:00+08:00`,
          dateTo: `${calendarDay}T14:00:00+08:00`,
          locale: "zh-cn",
        });
        expect(
          (result.events ?? []).some(
            (event) => event.type === "exam" && event.payload?.jwId === jwId,
          ),
        ).toBe(false);
      }),
  );

  toolTest(
    "对无效日期字符串返回描述性错误",
    { tags: ["@Calendar/MCP"] },
    async ({ mcpWorkflow, mcpActor: isolated, expect }) =>
      mcpWorkflow.run(async () => {
        const result = await isolated.client.call<{
          success?: boolean;
          message?: string;
        }>("workspace_schedule_list", {
          dateFrom: "not-a-date",
          limit: 5,
        });

        expect(result.success).toBe(false);
        expect(result.message).not.toContain("not-a-date");
        expect(result.message).toContain("Invalid dateFrom");
        expect(result.message).toContain("YYYY-MM-DD");
        expect(result.message?.toLowerCase()).toContain("invalid");
      }),
  );
});

// ---------------------------------------------------------------------------
// atTime override — reproducible time-sensitive tools
// ---------------------------------------------------------------------------
