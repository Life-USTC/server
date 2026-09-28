import { expect, type Page } from "@playwright/test";
import type { createCalendarContractFixture } from "./calendar-contract";
import { PLAYWRIGHT_BASE_URL } from "./e2e-db/core";
import { withE2ePrisma } from "./e2e-db/prisma";
import { gotoAndWaitForReady } from "./page-ready";
import { createSignedSessionCookie } from "./workspace-task-filters";

export type SubscriptionFixture = Awaited<
  ReturnType<typeof createCalendarContractFixture>
>;
export const subscriptionSnapshotAt = "2026-04-29T09:30:00+08:00";
export const subscriptionOverviewUrl = `/workspace/overview?snapshotAt=${encodeURIComponent(subscriptionSnapshotAt)}`;

export async function signInSubscriptionOwner(
  page: Page,
  fixture: SubscriptionFixture,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await createSignedSessionCookie(fixture.users[0].id),
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
    ]);
}

export async function observeSubscriptionState(fixture: SubscriptionFixture) {
  return withE2ePrisma(async (db) => ({
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
  }));
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
  await gotoAndWaitForReady(page, "/workspace/subscriptions");
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
