import { describe, expect, it } from "vitest";
import {
  applyLocalHomeworkItemsToSignedData,
  applyLocalTodoItemsToSignedData,
  buildDashboardControllerDerivedState,
} from "@/features/dashboard/lib/dashboard-controller-derived-state";
import type {
  DashboardLinkItem,
  DashboardPageData,
  HomeworkItem,
  SignedDashboardData,
  TodoItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import {
  DASHBOARD_LINK_GROUP_ORDER,
  type DashboardLinkGroup,
} from "@/features/dashboard-links/lib/dashboard-links";

const dashboardLinkGroupLabels = Object.fromEntries(
  DASHBOARD_LINK_GROUP_ORDER.map((group) => [group, group]),
) as Record<DashboardLinkGroup, string>;

function link(slug: string, isPinned: boolean): DashboardLinkItem {
  return {
    clickCount: 0,
    description: `${slug} description`,
    descriptionPinyin: `${slug}description`,
    group: "study",
    icon: "school",
    isPinned,
    slug,
    title: `${slug} portal`,
    titlePinyin: `${slug}portal`,
    url: `https://example.test/${slug}`,
  };
}

function signedDashboardData(
  dashboardLinks: DashboardLinkItem[],
): DashboardPageData {
  return {
    bus: null,
    copy: {} as DashboardPageData["copy"],
    homeworks: null,
    links: { dashboardLinks },
    locale: "zh-cn",
    navStats: {
      calendarItemsCount: 0,
      examsCount: 0,
      pendingHomeworksCount: 0,
      pendingTodosCount: 0,
    },
    overview: {
      calendar: null,
      dueToday: [],
      hasCurrentTermSelection: false,
      overviewLinks: dashboardLinks.slice(0, 1),
      pendingHomeworks: [],
      todaySessions: [],
    },
    signedIn: true,
    subscriptions: null,
    todos: [],
  };
}

function homework(id: string, completed: boolean): HomeworkItem {
  return {
    completion: completed ? { completedAt: "2026-06-22T10:00:00.000Z" } : null,
    id,
    submissionDueAt: null,
    title: id,
  };
}

describe("dashboard controller derived state", () => {
  it.each([
    { currentPinned: true, loadedPinned: false, name: "pin" },
    { currentPinned: false, loadedPinned: true, name: "unpin" },
  ])("keeps local link $name state when search recomputes derived groups", ({
    currentPinned,
    loadedPinned,
  }) => {
    const loadedLinks = [link("jw", loadedPinned), link("mail", false)];
    const currentLinks = [link("jw", currentPinned), link("mail", false)];

    const result = buildDashboardControllerDerivedState({
      currentDashboardLinkItems: currentLinks,
      currentOverviewLinkItems: currentLinks.slice(0, 1),
      currentTodoItems: [],
      dashboardLinkGroupLabels,
      data: signedDashboardData(loadedLinks),
      dateFallback: "TBD",
      examFilter: "incomplete",
      linkSearchQuery: "jw",
      notAvailable: "N/A",
      todoFilter: "incomplete",
    });

    expect(
      result.dashboardLinkItems.find((item) => item.slug === "jw")?.isPinned,
    ).toBe(currentPinned);
    expect(result.signedLinkGroups.flatMap((group) => group.links)).toEqual([
      expect.objectContaining({
        isPinned: currentPinned,
        slug: "jw",
      }),
    ]);
  });

  it("derives the signed dashboard homework badge count from local homework items", () => {
    const data = {
      ...signedDashboardData([]),
      homeworks: {
        homeworkSummaries: [homework("homework-1", false)],
        sections: [],
      },
      navStats: {
        calendarItemsCount: 0,
        examsCount: 0,
        pendingHomeworksCount: 2,
        pendingTodosCount: 0,
      },
      subscribedSectionCount: 0,
    } as SignedDashboardData;

    const nextHomeworks = [
      homework("homework-1", true),
      homework("homework-2", false),
    ];

    const result = applyLocalHomeworkItemsToSignedData(data, nextHomeworks);

    expect(result?.navStats.pendingHomeworksCount).toBe(1);
    expect(result?.homeworks?.homeworkSummaries).toBe(nextHomeworks);
  });

  it("derives the signed dashboard todo badge count from local todo items", () => {
    const data = {
      ...signedDashboardData([]),
      todos: [
        { id: "todo-1", completed: false },
        { id: "todo-2", completed: true },
      ],
      navStats: {
        calendarItemsCount: 0,
        examsCount: 0,
        pendingHomeworksCount: 0,
        pendingTodosCount: 2,
      },
    } as SignedDashboardData;

    const nextTodos = [
      { id: "todo-1", completed: true },
      { id: "todo-2", completed: true },
      { id: "todo-3", completed: false },
    ];

    const result = applyLocalTodoItemsToSignedData(
      data,
      nextTodos as TodoItem[],
    );

    expect(result?.navStats.pendingTodosCount).toBe(1);
    expect(result?.todos).toBe(nextTodos);
  });
});
