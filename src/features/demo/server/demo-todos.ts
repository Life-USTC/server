import type { DemoIdentity, DemoView } from "@/features/demo/lib/demo-types";
import type { TodoListFilters } from "@/features/todos/server/todo-service";
import { getWorkspacePageCopy } from "@/features/workspace/server/workspace-page-copy";
import type { TodoItem } from "@/features/workspace/server/workspace-tab-data";
import type { AppLocale } from "@/i18n/config";
import { buildPaginatedResponse, normalizePagination } from "@/lib/pagination";
import type { WorkspaceNavigationSummary } from "@/lib/shell/shell-bootstrap";
import enUs from "../../../../messages/en-us.json";
import zhCn from "../../../../messages/zh-cn.json";

const REFERENCE_NOW = "2026-09-24T09:00:00+08:00";
const CREATED_AT = "2026-09-22T09:00:00+08:00";

export function getDemoCopy(locale: AppLocale) {
  return (locale === "en-us" ? enUs : zhCn).demo;
}

export function getDemoView(
  identity: DemoIdentity,
  locale: AppLocale,
): DemoView {
  const copy = getDemoCopy(locale);
  return {
    ...identity,
    referenceNow: REFERENCE_NOW,
    displayName: copy.displayName,
    readOnlyReason: copy.readOnlyReason,
    exitLabel: copy.exit,
    unavailableReason: copy.unavailableReason,
    referenceTimeLabel: copy.referenceTime,
  };
}

export function getDemoTodos(locale: AppLocale): TodoItem[] {
  const english = locale === "en-us";
  const todos: Omit<TodoItem, "createdAt" | "updatedAt">[] = [
    {
      id: "demo-todo-reading",
      title: english ? "Review linear algebra" : "预习线性代数",
      content: english
        ? "Read chapter 3 and note questions."
        : "阅读第三章，记下需要讨论的问题。",
      priority: "high",
      completed: false,
      dueAt: "2026-09-23T18:00:00+08:00",
    },
    {
      id: "demo-todo-outline",
      title: english ? "Organize course notes" : "整理课程笔记",
      content: english
        ? "Summarize this week's key ideas."
        : "整理本周课程的重点。",
      priority: "medium",
      completed: false,
      dueAt: "2026-09-25T18:00:00+08:00",
    },
    {
      id: "demo-todo-library",
      title: english ? "Return library books" : "归还图书",
      content: null,
      priority: "low",
      completed: true,
      dueAt: null,
    },
  ];
  return todos.map((todo) => ({
    ...todo,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  }));
}

function demoCounts(todos: TodoItem[]) {
  return {
    incomplete: todos.filter((todo) => !todo.completed).length,
    completed: todos.filter((todo) => todo.completed).length,
    overdue: todos.filter(
      (todo) =>
        !todo.completed &&
        todo.dueAt &&
        Date.parse(todo.dueAt) < Date.parse(REFERENCE_NOW),
    ).length,
  };
}

export function getDemoNavigation(
  identity: DemoIdentity,
): WorkspaceNavigationSummary {
  return {
    userId: `demo:${identity.fixtureVersion}`,
    pendingTodosCount: demoCounts(getDemoTodos("zh-cn")).incomplete,
    unreadActivityNotificationsCount: 0,
    calendarItemsCount: 0,
    examsCount: 0,
    pendingHomeworksCount: 0,
    subscribedSectionCount: 0,
  };
}

export function getDemoTodosPage(identity: DemoIdentity, locale: AppLocale) {
  const demo = getDemoView(identity, locale);
  const copy = getWorkspacePageCopy(locale);
  const { userId, subscribedSectionCount, ...counts } =
    getDemoNavigation(identity);
  return {
    copy,
    locale,
    demo,
    referenceNow: REFERENCE_NOW,
    signedIn: true,
    tab: "todos" as const,
    mainContentLabel: copy.workspace.nav.todos.title,
    navStats: {
      ...counts,
      highlightPendingHomeworks: false,
      user: { id: userId, name: demo.displayName, username: null },
    },
    subscribedSectionCount,
    overview: null,
    links: null,
    homeworks: null,
    subscriptions: null,
    calendarSubscriptionUrl: null,
    todos: getDemoTodos(locale),
    bus: null,
  };
}

export function readDemoTodos(input: {
  locale: AppLocale;
  filters: TodoListFilters;
  limit?: number;
  page?: number;
  pageSize?: number;
}) {
  const all = getDemoTodos(input.locale);
  const { filters } = input;
  const matches = all.filter((todo) => {
    if (filters.completed !== undefined && todo.completed !== filters.completed)
      return false;
    if (filters.priority && todo.priority !== filters.priority) return false;
    if (
      filters.dueBefore &&
      (!todo.dueAt || Date.parse(todo.dueAt) >= filters.dueBefore.getTime())
    )
      return false;
    if (
      filters.dueAfter &&
      (!todo.dueAt || Date.parse(todo.dueAt) < filters.dueAfter.getTime())
    )
      return false;
    return true;
  });
  const counts = demoCounts(all);
  if (input.page !== undefined || input.pageSize !== undefined) {
    const pagination = normalizePagination(input);
    return {
      ...buildPaginatedResponse(
        matches.slice(pagination.skip, pagination.skip + pagination.pageSize),
        pagination.page,
        pagination.pageSize,
        matches.length,
      ),
      meta: { counts },
    };
  }
  return { counts, todos: matches.slice(0, input.limit) };
}
