import type { Locator, Page } from "@playwright/test";
import { gotoAndWaitForReady } from "./page-ready";
import {
  assertPriorityView,
  type VisiblePriorityField,
} from "./property-priority";
import type { WorkspacePriorityFixture } from "./property-priority-workspace-fixture";

const field = (
  locator: Locator,
  expected: string | RegExp,
): VisiblePriorityField => ({ locator, expected });
const text = (scope: Locator, expected: string | RegExp) =>
  field(scope.getByText(expected).filter({ visible: true }).first(), expected);
export async function checkWorkspaceOverviewPriorityViews(
  page: Page,
  data: WorkspacePriorityFixture,
  locale: "zh-cn" | "en-us",
  width: number,
) {
  const { todo, homework, catalog } = data;
  await gotoAndWaitForReady(
    page,
    `/workspace/overview?snapshotAt=${encodeURIComponent(`${data.today}T16:00:00+08:00`)}`,
  );
  const main = page.locator("#main-content");
  const focus = main.getByTestId("workspace-overview-focus");
  const identity = focus.getByTestId("overview-focus-title");
  const today = main
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: locale === "en-us" ? "Today" : "今天",
        exact: true,
      }),
    })
    .last();
  const week = main.getByTestId("workspace-overview-week");
  const courseName =
    locale === "en-us"
      ? (catalog.courses[0].nameEn ?? catalog.courses[0].nameCn)
      : catalog.courses[0].nameCn;
  const dueHomeworks = main
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: /未完成作业|Incomplete homework/i,
      }),
    })
    .last();
  const dueTodos = main
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /待办事项|Todos/i }) })
    .last();
  const upcomingExams = main
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: /考试与截止雷达|Exam and deadline radar/i,
      }),
    })
    .last();
  const date = new Date(`${data.today}T08:00:00Z`);
  const dateLabel = new Intl.DateTimeFormat(
    locale === "en-us" ? "en-US" : "zh-CN",
    { timeZone: "Asia/Shanghai", day: "numeric", month: "short" },
  ).format(date);
  const weekday = new Intl.DateTimeFormat(
    locale === "en-us" ? "en-US" : "zh-CN",
    { timeZone: "Asia/Shanghai", weekday: "long" },
  ).format(date);
  await assertPriorityView({
    scope: main,
    identity,
    primary: {
      "focus.title": field(identity, todo.title),
      "focus.label": field(
        focus.getByTestId("overview-focus-label"),
        locale === "en-us" ? "To-do" : "待办",
      ),
      "focus.status": field(
        focus.getByTestId("overview-focus-status"),
        locale === "en-us" ? "Needs attention" : "需要关注",
      ),
      "focus.time": field(focus.getByTestId("overview-focus-time"), "11:45"),
    },
    secondary: {
      "focus.dateLabel": field(
        focus.getByTestId("overview-focus-date"),
        dateLabel,
      ),
      "focus.weekdayLabel": field(
        focus.getByTestId("overview-focus-weekday"),
        weekday,
      ),
      "focus.detail": field(
        focus.getByTestId("overview-focus-detail"),
        todo.content ?? "",
      ),
      "todaySessions.startTime": text(today, "08:00"),
      "todaySessions.section.course.namePrimary": text(today, courseName),
      "dueTodayHomeworks.title": text(today, homework.title),
      "dueTodayTodos.title": text(today, todo.title),
      "days.label": text(week, new RegExp(String(Number(data.today.slice(8))))),
      "days.events.title": text(week, todo.title),
      "pendingHomeworks.title": text(dueHomeworks, homework.title),
      "pendingHomeworks.submissionDueAt": text(dueHomeworks, "12:30"),
      "pendingTodos.title": text(dueTodos, todo.title),
      "pendingTodos.dueAt": text(dueTodos, "11:45"),
      "upcomingExams.section.course.namePrimary": text(
        upcomingExams,
        courseName,
      ),
      "upcomingExams.examDate": text(
        upcomingExams,
        new RegExp(`${Number(data.tomorrow.slice(8))}|明天|Tomorrow`),
      ),
    },
    tertiary: { "focus.key": { value: `todo-${todo.id}` } },
  });
  // The same real week-strip cards scroll into view at both widths.
  for (const item of [
    {
      title: data.activity.name,
      time: "17:00",
      meta: data.activity.location ?? "",
    },
    {
      title: courseName,
      time: "08:00",
      meta: "09:35",
    },
    {
      title: todo.title,
      time: "11:45",
      meta: todo.content ?? "",
    },
    {
      title: homework.title,
      time: "12:30",
      meta: `Instructions ${catalog.marker}`,
    },
  ]) {
    const card = week.getByRole("link").filter({ hasText: item.title }).first();
    const cardTitle = card.locator('[data-slot="item-title"]');
    const metadata = (expected: string) =>
      field(
        card
          .locator('[data-slot="item-description"]')
          .filter({ hasText: expected })
          .first(),
        expected,
      );
    await assertPriorityView({
      scope: card,
      identity: cardTitle,
      primary: { "days.events.title": field(cardTitle, item.title) },
      secondary: {
        "days.events.time": metadata(item.time),
        "days.events.meta": metadata(item.meta),
      },
      tertiary: {},
    });
  }

  if (width < 768)
    await page.getByRole("button", { name: /^(菜单|Menu)$/i }).click();
  const navigation = page.locator(
    `[data-shell-navigation="${width < 768 ? "secondary" : "desktop"}"]`,
  );
  const item = navigation
    .getByRole("listitem")
    .filter({ has: page.locator('a[href="/workspace/todos"]') });
  const title = item.getByRole("link", {
    name: locale === "en-us" ? "Todos" : "待办",
    exact: true,
  });
  await assertPriorityView({
    scope: item,
    identity: title.locator("span").last(),
    primary: {
      "navigation.title": field(title, locale === "en-us" ? "Todos" : "待办"),
    },
    secondary: { "navigation.count": text(item, /^1$/) },
    tertiary: {},
  });
  if (width < 768) {
    await page.keyboard.press("Escape");
  }
}
