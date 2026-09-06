import { beforeEach, describe, expect, it, vi } from "vitest";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

const {
  buildWorkspaceOverviewScheduleMock,
  buildPreviewCalendarPayloadMock,
  buildSemesterCalendarPayloadMock,
  getWorkspaceOverviewLinksDataMock,
  listSemesterCalendarTodosMock,
  listSubscribedHomeworksMock,
  resolveWorkspaceOverviewContextMock,
  resolveWorkspaceOverviewSectionScopeMock,
} = vi.hoisted(() => ({
  buildWorkspaceOverviewScheduleMock: vi.fn(),
  buildPreviewCalendarPayloadMock: vi.fn(),
  buildSemesterCalendarPayloadMock: vi.fn(),
  getWorkspaceOverviewLinksDataMock: vi.fn(),
  listSemesterCalendarTodosMock: vi.fn(),
  listSubscribedHomeworksMock: vi.fn(),
  resolveWorkspaceOverviewContextMock: vi.fn(),
  resolveWorkspaceOverviewSectionScopeMock: vi.fn(),
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  listSubscribedHomeworks: listSubscribedHomeworksMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-calendar", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/workspace/server/workspace-overview-calendar")
  >("@/features/workspace/server/workspace-overview-calendar");
  return {
    ...actual,
    buildPreviewCalendarPayload: buildPreviewCalendarPayloadMock,
    buildSemesterCalendarPayload: buildSemesterCalendarPayloadMock,
  };
});

vi.mock(
  "@/features/workspace/server/workspace-overview-semester-todos",
  () => ({
    listSemesterCalendarTodos: listSemesterCalendarTodosMock,
  }),
);

vi.mock("@/features/workspace/server/workspace-overview-context", () => ({
  resolveWorkspaceOverviewContext: resolveWorkspaceOverviewContextMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-links", () => ({
  getWorkspaceOverviewLinksData: getWorkspaceOverviewLinksDataMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-schedule", () => ({
  buildWorkspaceOverviewSchedule: buildWorkspaceOverviewScheduleMock,
}));

vi.mock("@/features/workspace/server/workspace-overview-section-scope", () => ({
  resolveWorkspaceOverviewSectionScope:
    resolveWorkspaceOverviewSectionScopeMock,
}));

import { buildSubscribedHomeworkQuery } from "@/features/subscriptions/server/subscription-homework-query";
import { getWorkspaceOverviewData } from "@/features/workspace/server/workspace-overview-data";

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

describe("workspace overview homework read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const referenceNow = shanghaiDayjs("2026-05-22T10:30:00+08:00");
    resolveWorkspaceOverviewContextMock.mockResolvedValue({
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
    resolveWorkspaceOverviewSectionScopeMock.mockResolvedValue({
      calendarSemesterNavList: [],
      calendarSemesterPicker: [],
      currentTermName: "—",
      workspaceSections: [],
      hasAnySelection: true,
      hasCurrentTermSelection: true,
      homeworkSectionIds: [12],
      sectionsForCalendarGrid: [],
    });
    getWorkspaceOverviewLinksDataMock.mockResolvedValue({
      catalogLinks: [],
      overviewLinks: [],
      pinnedLinks: [],
      recommendedLinks: [],
    });
    listSemesterCalendarTodosMock.mockResolvedValue([]);
    buildWorkspaceOverviewScheduleMock.mockImplementation(() => ({
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

    await getWorkspaceOverviewData("user-1", {
      calendarMode: "preview",
      locale: "en-us",
      overviewWeek: "2026-05-17",
    });

    expect(resolveWorkspaceOverviewSectionScopeMock).toHaveBeenCalledWith(
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

    await getWorkspaceOverviewData("user-1", {
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

    await getWorkspaceOverviewData("user-1", { locale: "en-us" });

    expect(listSubscribedHomeworksMock).toHaveBeenCalledOnce();
    expect(listSubscribedHomeworksMock).toHaveBeenCalledWith("user-1", {
      incompleteOrHasDueDate: true,
      locale: "en-us",
      sectionIds: [12],
      shape: "workspace",
    });
    expect(buildWorkspaceOverviewScheduleMock).toHaveBeenCalledWith(
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

    resolveWorkspaceOverviewSectionScopeMock.mockImplementation(async () => {
      await sectionScopeGate;
      return {
        calendarSemesterNavList: [],
        calendarSemesterPicker: [],
        currentTermName: "—",
        workspaceSections: [],
        hasAnySelection: true,
        hasCurrentTermSelection: true,
        homeworkSectionIds: [12],
        sectionsForCalendarGrid: [],
      };
    });
    getWorkspaceOverviewLinksDataMock.mockImplementation(() => {
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

    const pending = getWorkspaceOverviewData("user-1", { locale: "en-us" });

    await vi.waitFor(() => {
      expect(linksStarted).toBe(true);
      expect(semesterTodosStarted).toBe(true);
    });
    expect(resolveWorkspaceOverviewSectionScopeMock).toHaveBeenCalled();
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
