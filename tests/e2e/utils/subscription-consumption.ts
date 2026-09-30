import { expect, type Page } from "@playwright/test";
import type { PrivateCalendar } from "./private-calendar-fixture";
import type { IsolatedWorker } from "./isolated-worker";
import { gotoAndWaitForReady } from "./page-ready";

export type SubscriptionFixture = PrivateCalendar;
export const subscriptionSnapshotAt = "2026-04-29T09:30:00+08:00";
export const subscriptionOverviewUrl = `/workspace/overview?snapshotAt=${encodeURIComponent(subscriptionSnapshotAt)}`;

export async function signInSubscriptionOwner(
  page: Page,
  fixture: SubscriptionFixture,
  worker: IsolatedWorker,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      (await worker.createSession(fixture.users[0].id)).cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: worker.origin },
    ]);
}

export async function observeSubscriptionState(
  fixture: SubscriptionFixture,
  worker: IsolatedWorker,
) {
  const db = worker.database.owner;
  return {
    sections: await db.userSectionSubscription.findMany({
      where: { userId: fixture.users[0].id },
      select: { sectionId: true, kind: true },
      orderBy: { sectionId: "asc" },
    }),
    todos: await db.todo.findMany({
      where: { userId: fixture.users[0].id },
      select: { id: true, title: true, completed: true },
      orderBy: { id: "asc" },
    }),
    activities: await db.userYoungEventSubscription.findMany({
      where: { userId: fixture.users[0].id },
      select: { youngId: true },
      orderBy: { youngId: "asc" },
    }),
  };
}

export function subscribedCourseLink(page: Page, fixture: SubscriptionFixture) {
  return page
    .getByTestId("subscription-course-link")
    .and(page.locator(`[href="/catalog/sections/${fixture.section.jwId}"]`))
    .filter({ visible: true });
}

export async function expectSubscribedWebProjections(
  page: Page,
  fixture: SubscriptionFixture,
  foreign?: SubscriptionFixture,
) {
  const expectOwnerIsolation = async () => {
    if (!foreign) return;
    await expect(page.locator("#main-content")).not.toContainText(
      String(foreign.course.nameEn),
    );
    await expect(page.locator("#main-content")).not.toContainText(
      foreign.todo.title,
    );
    await expect(page.locator("#main-content")).not.toContainText(
      foreign.young.name,
    );
  };
  await gotoAndWaitForReady(
    page,
    foreign
      ? `/workspace/subscriptions?userId=${foreign.users[0].id}`
      : "/workspace/subscriptions",
  );
  if (foreign) {
    await expect(
      page.locator(
        `a[data-testid="subscription-course-link"][href="/catalog/sections/${foreign.section.jwId}"]`,
      ),
    ).toHaveCount(0);
  }
  await expect(subscribedCourseLink(page, fixture)).toHaveText(
    String(fixture.course.nameEn),
  );
  await expectOwnerIsolation();
  await gotoAndWaitForReady(page, fixture.academicUrl());
  const calendar = page
    .locator(
      `#main-content a[href="/catalog/sections/${fixture.section.jwId}"]`,
    )
    .filter({ visible: true });
  await expect(calendar.first()).toContainText(String(fixture.course.nameEn));
  await expect(page.locator("#main-content")).toContainText("09:00");
  await expect(
    page
      .getByText(fixture.todo.title, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(fixture.young.name, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expectOwnerIsolation();
  await gotoAndWaitForReady(page, subscriptionOverviewUrl);
  const focus = page.getByTestId("workspace-overview-focus");
  await expect(focus.getByRole("link")).toHaveAttribute(
    "href",
    `/catalog/sections/${fixture.section.jwId}`,
  );
  await expect(focus).toContainText(String(fixture.course.nameEn));
  await expect(focus).toContainText("09:00-10:00");
  await expectOwnerIsolation();
}

export async function expectIndependentCalendarItems(
  page: Page,
  fixture: SubscriptionFixture,
) {
  await gotoAndWaitForReady(page, "/workspace/calendar");
  // Without course subscriptions the personal calendar owns its own date control.
  await page.locator("#personal-activity-date").fill(fixture.date);
  await expect(
    page
      .getByText(fixture.todo.title, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(fixture.young.name, { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.locator("#main-content")).not.toContainText(
    String(fixture.course.nameEn),
  );
  await expect(page.locator("#main-content")).not.toContainText(
    fixture.homework.title,
  );
}
