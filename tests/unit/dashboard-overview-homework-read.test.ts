import { beforeEach, describe, expect, it, vi } from "vitest";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const {
  buildDashboardOverviewScheduleMock,
  buildSemesterCalendarPayloadMock,
  getDashboardOverviewLinksDataMock,
  listSemesterCalendarTodosMock,
  listSubscribedHomeworksMock,
  resolveDashboardOverviewContextMock,
  resolveDashboardOverviewSectionScopeMock,
} = vi.hoisted(() => ({
  buildDashboardOverviewScheduleMock: vi.fn(),
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

vi.mock("@/features/dashboard/server/dashboard-overview-calendar", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/dashboard/server/dashboard-overview-calendar")
  >("@/features/dashboard/server/dashboard-overview-calendar");
  return {
    ...actual,
    buildSemesterCalendarPayload: buildSemesterCalendarPayloadMock,
  };
});

vi.mock(
  "@/features/dashboard/server/dashboard-overview-semester-todos",
  () => ({
    listSemesterCalendarTodos: listSemesterCalendarTodosMock,
  }),
);

vi.mock("@/features/dashboard/server/dashboard-overview-context", () => ({
  resolveDashboardOverviewContext: resolveDashboardOverviewContextMock,
}));

vi.mock("@/features/dashboard/server/dashboard-overview-links", () => ({
  getDashboardOverviewLinksData: getDashboardOverviewLinksDataMock,
}));

vi.mock("@/features/dashboard/server/dashboard-overview-schedule", () => ({
  buildDashboardOverviewSchedule: buildDashboardOverviewScheduleMock,
}));

vi.mock("@/features/dashboard/server/dashboard-overview-section-scope", () => ({
  resolveDashboardOverviewSectionScope:
    resolveDashboardOverviewSectionScopeMock,
}));

import { getDashboardOverviewData } from "@/features/dashboard/server/dashboard-overview-data";
import { buildSubscribedHomeworkQuery } from "@/features/subscriptions/server/subscription-homework-query";

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
      dashboardLinks: [],
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
      semesterWeeks: [],
    });
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
        dashboardLinks: [],
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
