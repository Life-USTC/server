import { beforeEach, describe, expect, it, vi } from "vitest";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const {
  buildDashboardOverviewScheduleMock,
  buildPreviewCalendarPayloadMock,
  buildSemesterCalendarPayloadMock,
  getDashboardOverviewLinksDataMock,
  listSemesterCalendarTodosMock,
  listSubscribedHomeworksMock,
  resolveDashboardOverviewContextMock,
  resolveDashboardOverviewSectionScopeMock,
} = vi.hoisted(() => ({
  buildDashboardOverviewScheduleMock: vi.fn(),
  buildPreviewCalendarPayloadMock: vi.fn(),
  buildSemesterCalendarPayloadMock: vi.fn(),
  getDashboardOverviewLinksDataMock: vi.fn(),
  listSemesterCalendarTodosMock: vi.fn(),
  listSubscribedHomeworksMock: vi.fn(),
  resolveDashboardOverviewContextMock: vi.fn(),
  resolveDashboardOverviewSectionScopeMock: vi.fn(),
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedHomeworks: listSubscribedHomeworksMock,
}));

vi.mock("@/features/workspace/server/dashboard-overview-calendar", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/workspace/server/dashboard-overview-calendar")
  >("@/features/workspace/server/dashboard-overview-calendar");
  return {
    ...actual,
    buildPreviewCalendarPayload: buildPreviewCalendarPayloadMock,
    buildSemesterCalendarPayload: buildSemesterCalendarPayloadMock,
  };
});

vi.mock(
  "@/features/workspace/server/dashboard-overview-semester-todos",
  () => ({
    listSemesterCalendarTodos: listSemesterCalendarTodosMock,
  }),
);

vi.mock("@/features/workspace/server/dashboard-overview-context", () => ({
  resolveDashboardOverviewContext: resolveDashboardOverviewContextMock,
}));

vi.mock("@/features/workspace/server/dashboard-overview-links", () => ({
  getDashboardOverviewLinksData: getDashboardOverviewLinksDataMock,
}));

vi.mock("@/features/workspace/server/dashboard-overview-schedule", () => ({
  buildDashboardOverviewSchedule: buildDashboardOverviewScheduleMock,
}));

vi.mock("@/features/workspace/server/dashboard-overview-section-scope", () => ({
  resolveDashboardOverviewSectionScope:
    resolveDashboardOverviewSectionScopeMock,
}));

import { buildSubscribedHomeworkQuery } from "@/features/subscriptions/server/subscription-homework-query";
import { getDashboardOverviewData } from "@/features/workspace/server/dashboard-overview-data";

function homework(id: string, completed: boolean, due: boolean) {
  return {
    id,
    title: id,
    publishedAt: null,
    submissionStartAt: null,
    submissionDueAt: due ? new Date("2026-05-23T00:00:00.000Z") : null,
    homeworkCompletions: completed
      ? [{ completedAt: new Date("2026-05-22T00:00:00.000Z") }]
      : [],
    section: null,
  };
}

describe("dashboard overview homework read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const referenceNow = shanghaiDayjs("2026-05-22T10:30:00+08:00");
    resolveDashboardOverviewContextMock.mockResolvedValue({
      locale: "en-us",
      referenceNow,
      semesterContext: {
        calendarSemesterFromUrlValid: false,
        currentSemester: null,
        gridSemesterRow: null,
        scheduleDateEnd: null,
        scheduleDateStart: null,
      },
      semesters: [],
      user: { id: "user-1", name: "User", username: "user" },
    });
    resolveDashboardOverviewSectionScopeMock.mockResolvedValue({
      calendarSemesterNavList: [],
      calendarSemesterPicker: [],
      currentTermName: "—",
      dashboardSections: [],
      hasAnySelection: true,
      hasCurrentTermSelection: true,
      homeworkSectionIds: [12],
      sectionsForCalendarGrid: [],
    });
    getDashboardOverviewLinksDataMock.mockResolvedValue({
      catalogLinks: [],
      overviewLinks: [],
      pinnedLinks: [],
      recommendedLinks: [],
    });
    listSemesterCalendarTodosMock.mockResolvedValue([]);
    buildDashboardOverviewScheduleMock.mockImplementation(() => ({
      calendarDays: [],
      calendarHomeworks: [],
      calendarSessions: [],
      dueToday: [],
      dueWithin3Days: [],
      incompleteHomeworks: [],
      timeSlots: [],
      todaySessions: [],
      todayStart: referenceNow.startOf("day"),
      tomorrowSessions: [],
      weekDayFormatter: new Intl.DateTimeFormat("en-US"),
      weekDays: [],
      weeklySessions: [],
    }));
    buildSemesterCalendarPayloadMock.mockReturnValue({
      allExams: [],
      allSessions: [],
      semesterEnd: null,
      semesterHomeworks: [],
      semesterStart: null,
      semesterTodos: [],
      semesterWeeks: [],
    });
    buildPreviewCalendarPayloadMock.mockReturnValue({
      allExams: [],
      allSessions: [],
      semesterEnd: null,
      semesterHomeworks: [],
      semesterStart: null,
      semesterTodos: [],
      semesterWeeks: [],
    });
  });

  it("bounds overview reads to preview dates and skips the semester payload", async () => {
    listSubscribedHomeworksMock.mockResolvedValue([]);

    await getDashboardOverviewData("user-1", {
      calendarMode: "preview",
      locale: "en-us",
      overviewWeek: "2026-05-17",
    });

    expect(resolveDashboardOverviewSectionScopeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleDateStart: new Date("2026-05-16T16:00:00.000Z"),
        scheduleDateEnd: new Date("2026-05-28T15:59:59.999Z"),
      }),
    );
    expect(listSemesterCalendarTodosMock).toHaveBeenCalledWith({
      semesterStart: expect.objectContaining({}),
      semesterEnd: expect.objectContaining({}),
      userId: "user-1",
    });
    const todoRange = listSemesterCalendarTodosMock.mock.calls[0]?.[0];
    expect(todoRange.semesterStart.format("YYYY-MM-DD")).toBe("2026-05-17");
    expect(todoRange.semesterEnd.format("YYYY-MM-DD")).toBe("2026-05-28");
    expect(buildPreviewCalendarPayloadMock).toHaveBeenCalledOnce();
    expect(buildSemesterCalendarPayloadMock).not.toHaveBeenCalled();
  });

  it("reuses a provided todo snapshot instead of querying calendar todos", async () => {
    listSubscribedHomeworksMock.mockResolvedValue([]);
    const calendarTodos = [
      {
        completed: false,
        content: null,
        dueAt: "2026-05-23T10:00:00+08:00",
        id: "todo-1",
        priority: "medium" as const,
        title: "Review",
      },
    ];

    await getDashboardOverviewData("user-1", {
      calendarMode: "preview",
      calendarTodos,
      locale: "en-us",
    });

    expect(listSemesterCalendarTodosMock).not.toHaveBeenCalled();
    expect(buildPreviewCalendarPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ todos: calendarTodos }),
    );
  });

  it("uses one union read and preserves all four completion/due-date quadrants", async () => {
    const incompleteWithDue = homework("incomplete-due", false, true);
    const incompleteWithoutDue = homework("incomplete-no-due", false, false);
    const completedWithDue = homework("completed-due", true, true);
    const completedWithoutDue = homework("completed-no-due", true, false);
    listSubscribedHomeworksMock.mockResolvedValue([
      incompleteWithDue,
      incompleteWithoutDue,
      completedWithDue,
      completedWithoutDue,
    ]);

    await getDashboardOverviewData("user-1", { locale: "en-us" });

    expect(listSubscribedHomeworksMock).toHaveBeenCalledOnce();
    expect(listSubscribedHomeworksMock).toHaveBeenCalledWith("user-1", {
      incompleteOrHasDueDate: true,
      locale: "en-us",
      sectionIds: [12],
      shape: "dashboard",
    });
    expect(buildDashboardOverviewScheduleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        homeworks: [incompleteWithDue, incompleteWithoutDue],
      }),
    );
    expect(buildSemesterCalendarPayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarHomeworks: [incompleteWithDue],
        semesterTodos: [],
      }),
    );
  });

  it("starts links and semester todos before section scope completes", async () => {
    let releaseSectionScope!: () => void;
    const sectionScopeGate = new Promise<void>((resolve) => {
      releaseSectionScope = resolve;
    });
    let linksStarted = false;
    let semesterTodosStarted = false;

    resolveDashboardOverviewSectionScopeMock.mockImplementation(async () => {
      await sectionScopeGate;
      return {
        calendarSemesterNavList: [],
        calendarSemesterPicker: [],
        currentTermName: "—",
        dashboardSections: [],
        hasAnySelection: true,
        hasCurrentTermSelection: true,
        homeworkSectionIds: [12],
        sectionsForCalendarGrid: [],
      };
    });
    getDashboardOverviewLinksDataMock.mockImplementation(() => {
      linksStarted = true;
      return Promise.resolve({
        catalogLinks: [],
        overviewLinks: [],
        pinnedLinks: [],
        recommendedLinks: [],
      });
    });
    listSemesterCalendarTodosMock.mockImplementation(() => {
      semesterTodosStarted = true;
      return Promise.resolve([]);
    });
    listSubscribedHomeworksMock.mockResolvedValue([]);

    const pending = getDashboardOverviewData("user-1", { locale: "en-us" });

    await vi.waitFor(() => {
      expect(linksStarted).toBe(true);
      expect(semesterTodosStarted).toBe(true);
    });
    expect(resolveDashboardOverviewSectionScopeMock).toHaveBeenCalled();
    expect(listSubscribedHomeworksMock).not.toHaveBeenCalled();

    releaseSectionScope();
    await pending;

    expect(listSubscribedHomeworksMock).toHaveBeenCalledOnce();
  });

  it("builds the exact database union and excludes completed undated rows", () => {
    const query = buildSubscribedHomeworkQuery({
      incompleteOrHasDueDate: true,
      includeDeleted: false,
      requireDueDate: false,
      sectionIds: [12],
      userId: "user-1",
    });

    expect(query.where).toEqual({
      deletedAt: null,
      OR: [
        { homeworkCompletions: { none: { userId: "user-1" } } },
        { submissionDueAt: { not: null } },
      ],
      sectionId: { in: [12] },
    });
  });
});
