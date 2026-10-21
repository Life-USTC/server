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
  const urgency = main.getByTestId("workspace-overview-urgency");
  const upcoming = main.getByTestId("workspace-overview-upcoming");
  const courseName =
    locale === "en-us"
      ? (catalog.courses[0].nameEn ?? catalog.courses[0].nameCn)
      : catalog.courses[0].nameCn;
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
      "urgency.title": text(urgency, homework.title),
      "urgency.time": text(urgency, "12:30"),
      "upcoming.title": text(upcoming, courseName),
      "upcoming.dateLabel": text(
        upcoming,
        new RegExp(`${Number(data.tomorrow.slice(8))}`),
      ),
    },
    tertiary: { "focus.key": { value: `todo-${todo.id}` } },
  });
  for (const item of [
    {
      scope: upcoming,
      title: data.activity.name,
      time: "17:00",
      meta: data.activity.location ?? "",
    },
    {
      scope: urgency,
      title: homework.title,
      time: "12:30",
      meta: `Instructions ${catalog.marker}`,
    },
  ]) {
    const card = item.scope
      .locator("a[data-overview-item]")
      .filter({ hasText: item.title })
      .first();
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
      primary: { "items.title": field(cardTitle, item.title) },
      secondary: {
        "items.time": metadata(item.time),
        "items.detail": metadata(item.meta),
      },
      tertiary: {},
    });
  }

  if (width < 768)
    await page.getByRole("button", { name: /^(菜单|Menu)$/i }).click();
  const navigation = page.locator(
    `[data-shell-navigation="${width < 768 ? "mobile" : "desktop"}"]`,
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
