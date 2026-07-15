import { describe, expect, it } from "vitest";
import { serializeDashboardOverview } from "@/features/dashboard/server/dashboard-overview-serialization";
import type { OverviewData } from "@/features/dashboard/server/dashboard-overview-types";
import type {
  ExamItem,
  HomeworkWithSection,
  SessionItem,
} from "@/features/dashboard/server/dashboard-types";
import { TodoPriority } from "@/generated/prisma/client";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { DEV_SEED_ANCHOR } from "../fixtures/dev-seed";

const today = shanghaiDayjs(DEV_SEED_ANCHOR.startOfDayAtTime);

function buildOverviewData(partial: Partial<OverviewData> = {}): OverviewData {
  return {
    user: { id: "user-1", name: "Test User", username: "testuser" },
    currentTermName: "2026春",
    hasAnySelection: true,
    hasCurrentTermSelection: true,
    todaySessions: [],
    tomorrowSessions: [],
    weeklySessions: [],
    weekDays: [],
    timeSlots: [],
    incompleteHomeworks: [],
    dueToday: [],
    dueWithin3Days: [],
    calendarSessions: [],
    calendarHomeworks: [],
    calendarDays: [],
    weekDayFormatter: new Intl.DateTimeFormat("zh-CN"),
    referenceNow: today,
    todayStart: today.startOf("day"),
    semesterStart: today.subtract(30, "day"),
    semesterEnd: today.add(60, "day"),
    semesterWeeks: [
      Array.from({ length: 7 }, (_, index) =>
        today.startOf("week").add(index, "day"),
      ),
    ],
    allSessions: [],
    allExams: [],
    semesterHomeworks: [],
    semesterTodos: [],
    calendarSemesterPicker: [],
    calendarSemesterNavList: [],
    activeCalendarSemesterId: null,
    defaultCalendarSemesterId: null,
    activeCalendarSemesterName: null,
    dashboardLinks: [],
    recommendedLinks: [],
    pinnedLinks: [],
    overviewLinks: [],
    ...partial,
  };
}

function buildSession(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    id: "session-1",
    sectionJwId: 101,
    courseName: "计算机导论",
    date: new Date("2026-04-29T08:00:00+08:00"),
    startTime: 800,
    endTime: 920,
    location: "第二教学楼 201",
    teacherDisplay: "张教授",
    ...overrides,
  };
}

function buildExam(overrides: Partial<ExamItem> = {}): ExamItem {
  return {
    id: "exam-1",
    courseName: "高等数学",
    date: new Date("2026-05-10T09:00:00+08:00"),
    startTime: 900,
    endTime: 1100,
    examType: 1,
    examMode: "offline",
    examTakeCount: 1,
    rooms: [{ room: "第三教学楼 301", count: 45 }],
    ...overrides,
  };
}

function buildHomework(
  overrides: Partial<HomeworkWithSection> = {},
): HomeworkWithSection {
  return {
    id: "hw-1",
    title: "第一次作业",
    publishedAt: new Date("2026-04-28T08:00:00+08:00"),
    submissionStartAt: new Date("2026-04-28T08:00:00+08:00"),
    submissionDueAt: new Date("2026-04-29T23:59:00+08:00"),
    homeworkCompletions: [],
    section: {
      id: 101,
      jwId: 101,
      course: {
        id: 1,
        jwId: 1001,
        code: "CS101",
        nameCn: "计算机导论",
        nameEn: null,
        categoryId: null,
        classTypeId: null,
        classifyId: null,
        educationLevelId: null,
        gradationId: null,
        typeId: null,
        namePrimary: "计算机导论",
      },
    } as HomeworkWithSection["section"],
    ...overrides,
  } as HomeworkWithSection;
}

function buildLinkSummary() {
  return {
    slug: "library",
    title: "图书馆",
    url: "https://lib.ustc.edu.cn",
    description: "馆藏查询",
    titlePinyin: "tushuguan",
    descriptionPinyin: "guangcangchaxun",
    icon: "book-open" as const,
    group: "study" as const,
    isPinned: false,
    clickCount: 3,
  };
}

describe("仪表盘概览序列化", () => {
  it("将完整的概览数据序列化为 JSON 友好的结构", () => {
    const overview = buildOverviewData({
      user: { id: "u1", name: "Alice", username: "alice" },
      currentTermName: "2026春",
      hasAnySelection: true,
      hasCurrentTermSelection: true,
      todaySessions: [buildSession()],
      tomorrowSessions: [buildSession({ id: "session-2" })],
      dueToday: [buildHomework({ id: "hw-due-today" })],
      dueWithin3Days: [buildHomework({ id: "hw-due-soon" })],
      incompleteHomeworks: [buildHomework({ id: "hw-incomplete" })],
      allSessions: [buildSession()],
      allExams: [buildExam()],
      semesterHomeworks: [
        buildHomework({
          id: "hw-semester",
          description: { content: "完成课后习题 1-5" },
        }),
      ],
      semesterTodos: [
        {
          id: "todo-1",
          title: "复习笔记",
          dueAt: "2026-05-01T10:00:00+08:00",
          priority: TodoPriority.high,
          content: "重点复习第一章",
          completed: false,
        },
      ],
      calendarSemesterPicker: [{ id: 1, nameCn: "2026春" }],
      calendarSemesterNavList: [{ id: 1, nameCn: "2026春" }],
      activeCalendarSemesterId: 1,
      defaultCalendarSemesterId: 1,
      activeCalendarSemesterName: "2026春",
      overviewLinks: [buildLinkSummary()],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.user).toEqual({
      id: "u1",
      name: "Alice",
      username: "alice",
    });
    expect(result.currentTermName).toBe("2026春");
    expect(result.hasAnySelection).toBe(true);
    expect(result.hasCurrentTermSelection).toBe(true);
    expect(result.todaySessions).toHaveLength(1);
    expect(result.tomorrowSessions).toHaveLength(1);

    expect(result.dueToday).toHaveLength(1);
    expect(result.dueToday[0].id).toBe("hw-due-today");
    expect(result.dueWithin3Days).toHaveLength(1);
    expect(result.pendingHomeworks).toHaveLength(3);

    expect(result.calendar.todayDate).toBe("2026-04-29");
    expect(result.calendar.referenceDate).toBe("2026-04-29");
    expect(result.calendar.semesterStart).toBe("2026-03-30");
    expect(result.calendar.semesterEnd).toBe("2026-06-28");
    expect(result.calendar.semesterWeeks).toHaveLength(1);
    expect(result.calendar.semesterWeeks[0]).toHaveLength(7);

    expect(result.calendar.allSessions).toHaveLength(1);
    const serializedSession = result.calendar.allSessions[0];
    expect(serializedSession.id).toBe("session-1");
    expect(serializedSession.date).toBeInstanceOf(Date);
    expect(serializedSession.dateKey).toBe("2026-04-29");
    expect(serializedSession.courseName).toBe("计算机导论");

    expect(result.calendar.allExams).toHaveLength(1);
    const serializedExam = result.calendar.allExams[0];
    expect(serializedExam.id).toBe("exam-1");
    expect(serializedExam.date).toBeInstanceOf(Date);
    expect(serializedExam.dateKey).toBe("2026-05-10");
    expect(serializedExam.examMode).toBe("offline");
    expect(serializedExam.rooms).toEqual([
      { room: "第三教学楼 301", count: 45 },
    ]);

    expect(result.calendar.semesterHomeworks).toHaveLength(1);
    const serializedSemesterHomework = result.calendar.semesterHomeworks[0];
    expect(serializedSemesterHomework.id).toBe("hw-semester");
    expect(serializedSemesterHomework.description).toBe("完成课后习题 1-5");
    expect(serializedSemesterHomework.dateKey).toBe("2026-04-29");

    expect(result.calendar.semesterTodos).toHaveLength(1);
    const serializedTodo = result.calendar.semesterTodos[0];
    expect(serializedTodo.id).toBe("todo-1");
    expect(serializedTodo.dateKey).toBe("2026-05-01");

    expect(result.calendar.calendarSemesterNavList).toEqual([
      { id: 1, nameCn: "2026春" },
    ]);
    expect(result.calendar.calendarSemesterPicker).toEqual([
      { id: 1, nameCn: "2026春" },
    ]);
    expect(result.calendar.activeCalendarSemesterId).toBe(1);
    expect(result.calendar.defaultCalendarSemesterId).toBe(1);
    expect(result.calendar.activeCalendarSemesterName).toBe("2026春");

    expect(result.overviewLinks).toHaveLength(1);
    expect(result.overviewLinks[0].slug).toBe("library");
  });

  it("去重 pendingHomeworks 中的重复作业", () => {
    const sharedHomework = buildHomework({ id: "shared" });
    const overview = buildOverviewData({
      dueToday: [sharedHomework],
      dueWithin3Days: [sharedHomework],
      incompleteHomeworks: [sharedHomework, buildHomework({ id: "other" })],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.dueToday).toHaveLength(1);
    expect(result.dueWithin3Days).toHaveLength(1);
    expect("incompleteHomeworks" in result).toBe(false);
    expect(result.pendingHomeworks).toHaveLength(2);
    expect(result.pendingHomeworks.map((item) => item.id)).toEqual([
      "shared",
      "other",
    ]);
  });

  it("根据 homeworkCompletions 标记作业完成状态", () => {
    const overview = buildOverviewData({
      dueToday: [
        buildHomework({
          id: "completed",
          homeworkCompletions: [{ completedAt: new Date() }],
        }),
        buildHomework({ id: "pending", homeworkCompletions: [] }),
      ],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.dueToday[0].completed).toBe(true);
    expect(result.dueToday[1].completed).toBe(false);
  });

  it("处理缺失或空的 section 与 course 名称", () => {
    const overview = buildOverviewData({
      dueToday: [
        buildHomework({
          id: "no-section",
          section: null,
        }),
        buildHomework({
          id: "empty-course-name",
          section: {
            id: 102,
            jwId: 102,
            course: {
              id: 2,
              jwId: 1002,
              code: "CS102",
              nameCn: "",
              nameEn: null,
              categoryId: null,
              classTypeId: null,
              classifyId: null,
              educationLevelId: null,
              gradationId: null,
              typeId: null,
              namePrimary: null,
            },
          } as HomeworkWithSection["section"],
        }),
      ],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.dueToday[0].section).toBeNull();
    expect(result.dueToday[1].section).toEqual({
      jwId: 102,
      course: { namePrimary: null },
    });
  });

  it("将日期按上海时区格式化为日期键", () => {
    const overview = buildOverviewData({
      allSessions: [
        buildSession({
          id: "utc-edge",
          date: new Date("2026-04-28T16:00:00.000Z"),
        }),
      ],
      allExams: [buildExam({ id: "null-date", date: null })],
      semesterTodos: [
        {
          id: "todo-string-date",
          title: "string date todo",
          dueAt: "2026-04-28T16:00:00.000Z",
          priority: TodoPriority.low,
          content: null,
          completed: false,
        },
      ],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.calendar.allSessions[0].dateKey).toBe("2026-04-29");
    expect(result.calendar.allExams[0].dateKey).toBeNull();
    expect(result.calendar.semesterTodos[0].dateKey).toBe("2026-04-29");
  });

  it("处理空的学期边界和周网格", () => {
    const overview = buildOverviewData({
      semesterStart: null,
      semesterEnd: null,
      semesterWeeks: [],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.calendar.semesterStart).toBeNull();
    expect(result.calendar.semesterEnd).toBeNull();
    expect(result.calendar.semesterWeeks).toEqual([]);
  });

  it("保留未改动的 overviewLinks", () => {
    const links = [buildLinkSummary(), { ...buildLinkSummary(), slug: "mail" }];
    const overview = buildOverviewData({ overviewLinks: links });

    const result = serializeDashboardOverview(overview);

    expect(result.overviewLinks).toBe(links);
    expect(result.overviewLinks).toHaveLength(2);
  });

  it("处理缺失的描述和空数组", () => {
    const overview = buildOverviewData({
      semesterHomeworks: [
        buildHomework({
          id: "with-description",
          description: {
            content: null,
          } as unknown as HomeworkWithSection["description"],
        }),
        buildHomework({
          id: "without-description",
        }),
      ],
      allSessions: [],
      allExams: [],
      semesterTodos: [],
    });

    const result = serializeDashboardOverview(overview);

    expect(result.calendar.semesterHomeworks[0].description).toBeNull();
    expect(result.calendar.semesterHomeworks[1].description).toBeNull();
    expect(result.calendar.allSessions).toEqual([]);
    expect(result.calendar.allExams).toEqual([]);
    expect(result.calendar.semesterTodos).toEqual([]);
  });
});
