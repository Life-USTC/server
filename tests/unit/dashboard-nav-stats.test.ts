import { afterEach, describe, expect, it, vi } from "vitest";

const {
  countIncompleteTodosMock,
  countUpcomingSubscribedExamsMock,
  getDashboardCalendarItemsCountMock,
  homeworkCountMock,
  homeworkFindFirstMock,
} = vi.hoisted(() => ({
  countIncompleteTodosMock: vi.fn(),
  countUpcomingSubscribedExamsMock: vi.fn(),
  getDashboardCalendarItemsCountMock: vi.fn(),
  homeworkCountMock: vi.fn(),
  homeworkFindFirstMock: vi.fn(),
}));

vi.mock("@/features/subscriptions/server/subscription-read-model", () => ({
  countUpcomingSubscribedExams: countUpcomingSubscribedExamsMock,
}));

vi.mock("@/features/todos/server/todo-service", () => ({
  countIncompleteTodos: countIncompleteTodosMock,
}));

vi.mock("@/features/dashboard/server/dashboard-calendar-count", () => ({
  getDashboardCalendarItemsCount: getDashboardCalendarItemsCountMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    homework: {
      count: homeworkCountMock,
      findFirst: homeworkFindFirstMock,
    },
  },
}));

describe("仪表盘导航统计", () => {
  afterEach(() => {
    countIncompleteTodosMock.mockReset();
    countUpcomingSubscribedExamsMock.mockReset();
    getDashboardCalendarItemsCountMock.mockReset();
    homeworkCountMock.mockReset();
    homeworkFindFirstMock.mockReset();
    vi.resetModules();
  });

  it("对考试徽章使用共享的即将到来考试计数语义", async () => {
    const referenceNow = new Date("2026-05-22T10:30:00.000Z");
    countIncompleteTodosMock.mockResolvedValue(4);
    homeworkCountMock.mockResolvedValue(2);
    homeworkFindFirstMock.mockResolvedValue({ id: "homework-due-today" });
    countUpcomingSubscribedExamsMock.mockResolvedValue(3);
    getDashboardCalendarItemsCountMock.mockResolvedValue(9);

    const { getDashboardNavStats } = await import(
      "@/features/dashboard/server/dashboard-nav-stats"
    );

    const result = await getDashboardNavStats(
      { id: "user-1", name: "User", username: "user" },
      [
        { id: 12, semesterId: 1 },
        { id: 34, semesterId: 1 },
      ],
      referenceNow,
    );

    expect(countUpcomingSubscribedExamsMock).toHaveBeenCalledWith({
      atTime: referenceNow,
      sectionIds: [12, 34],
    });
    expect(result.examsCount).toBe(3);
    expect(result.highlightPendingHomeworks).toBe(true);
  });
});
