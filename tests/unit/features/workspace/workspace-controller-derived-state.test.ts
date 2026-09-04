import { describe, expect, it } from "vitest";
import {
  CATALOG_LINK_GROUP_ORDER,
  type CatalogLinkGroup,
} from "@/features/catalog-links/lib/catalog-links";
import {
  applyLocalHomeworkItemsToSignedData,
  applyLocalTodoItemsToSignedData,
  buildWorkspaceControllerDerivedState,
} from "@/features/workspace/lib/workspace-controller-derived-state";
import type {
  CatalogLinkItem,
  HomeworkItem,
  SignedWorkspaceData,
  TodoItem,
  WorkspacePageData,
} from "@/features/workspace/lib/workspace-controller-helpers";

const catalogLinkGroupLabels = Object.fromEntries(
  CATALOG_LINK_GROUP_ORDER.map((group) => [group, group]),
) as Record<CatalogLinkGroup, string>;

function link(slug: string, isPinned: boolean): CatalogLinkItem {
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

function signedWorkspaceData(
  catalogLinks: CatalogLinkItem[],
): WorkspacePageData {
  return {
    bus: null,
    copy: {} as WorkspacePageData["copy"],
    homeworks: null,
    links: { catalogLinks },
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
      overviewLinks: catalogLinks.slice(0, 1),
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

describe("仪表盘控制器派生状态", () => {
  it.each([
    { currentPinned: true, loadedPinned: false, name: "pin" },
    { currentPinned: false, loadedPinned: true, name: "unpin" },
  ])(
    "keeps local link $name state when search recomputes derived groups",
    ({ currentPinned, loadedPinned }) => {
      const loadedLinks = [link("jw", loadedPinned), link("mail", false)];
      const currentLinks = [link("jw", currentPinned), link("mail", false)];

      const result = buildWorkspaceControllerDerivedState({
        currentCatalogLinkItems: currentLinks,
        currentOverviewLinkItems: currentLinks.slice(0, 1),
        currentTodoItems: [],
        catalogLinkGroupLabels,
        data: signedWorkspaceData(loadedLinks),
        dateFallback: "TBD",
        examFilter: "incomplete",
        linkSearchQuery: "jw",
        notAvailable: "N/A",
        todoFilter: "incomplete",
      });

      expect(
        result.catalogLinkItems.find((item) => item.slug === "jw")?.isPinned,
      ).toBe(currentPinned);
      expect(result.signedLinkGroups.flatMap((group) => group.links)).toEqual([
        expect.objectContaining({
          isPinned: currentPinned,
          slug: "jw",
        }),
      ]);
    },
  );

  it("根据本地作业项推导已登录仪表盘作业徽章数量", () => {
    const data = {
      ...signedWorkspaceData([]),
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
    } as SignedWorkspaceData;

    const nextHomeworks = [
      homework("homework-1", true),
      homework("homework-2", false),
    ];

    const result = applyLocalHomeworkItemsToSignedData(data, nextHomeworks);

    expect(result?.navStats.pendingHomeworksCount).toBe(1);
    expect(result?.homeworks?.homeworkSummaries).toBe(nextHomeworks);
  });

  it("根据本地待办项推导已登录仪表盘待办徽章数量", () => {
    const data = {
      ...signedWorkspaceData([]),
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
    } as SignedWorkspaceData;

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
