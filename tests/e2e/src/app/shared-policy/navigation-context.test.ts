import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test as diagnosticTest } from "../../../utils/navigation-network-diagnostic";
import { test } from "../../../utils/navigation-policy-fixture";

async function fixture(db: TestPrismaClient) {
  const suffix = crypto.randomUUID().slice(0, 8);
  return db.$transaction(async (db) => {
    const users = [];
    for (const role of ["academic", "personal"])
      users.push(
        await db.user.create({
          data: {
            name: `${role}-${suffix}`,
            username: `${role}-${suffix}`,
            email: `${role}-${suffix}@test.invalid`,
            emailVerified: true,
          },
        }),
      );
    const jwId = 1_800_000_000 + Math.floor(Math.random() * 100_000_000);
    const course = await db.course.create({
      data: {
        jwId,
        code: `NAV${suffix}`,
        nameCn: "导航课程",
        nameEn: "Navigation course",
      },
    });
    const section = await db.section.create({
      data: { jwId, code: `NAV.${suffix}`, courseId: course.id },
    });
    await db.userSectionSubscription.create({
      data: { userId: users[0].id, sectionId: section.id },
    });
    const organizer = await db.youngOrganizer.create({
      data: {
        name: `Navigation organizer ${suffix}`,
        normalizedName: `nav-${suffix}`,
      },
    });
    const now = Date.now();
    const notices = [];
    for (const [owner, state] of [
      [0, "unread"],
      [0, "future"],
      [0, "read"],
      [0, "expired"],
      [1, "unread"],
      [1, "read"],
      [1, "expired"],
    ] as const) {
      notices.push(
        await db.youngNotification.create({
          data: {
            userId: users[owner].id,
            organizerId: organizer.id,
            kind: "organizer_digest",
            title: `Owner ${owner} ${state} ${suffix}`,
            body: "Navigation evidence",
            dedupeKey: crypto.randomUUID(),
            readAt: state === "read" ? new Date(now - 1000) : null,
            expiresAt:
              state === "expired"
                ? new Date(now - 86_400_000)
                : state === "future"
                  ? new Date(now + 86_400_000)
                  : null,
          },
        }),
      );
    }
    return { users, section, course, organizer, notices };
  });
}
async function identify(page: Page, worker: IsolatedWorker, userId: string) {
  const session = await worker.createSession(userId);
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      session.cookie,
      { name: "NEXT_LOCALE", value: "en-us", url: worker.origin },
    ]);
}
async function sidebar(page: Page, width: number) {
  if (width < 768) {
    const dialog = page.getByRole("dialog", { name: "Sidebar", exact: true });
    if (!(await dialog.isVisible()))
      await page
        .locator("[data-shell-topbar]")
        .getByRole("button", { name: "Menu", exact: true })
        .click();
    return dialog;
  }
  return page.getByTestId("app-sidebar");
}
async function insideHorizontalViewport(link: Locator, viewport: Locator) {
  const [item, region] = await Promise.all([
    link.boundingBox(),
    viewport.boundingBox(),
  ]);
  expect(item).not.toBeNull();
  expect(region).not.toBeNull();
  if (!item || !region) throw new Error("Expected navigation geometry");
  expect(item.x).toBeGreaterThanOrEqual(region.x - 1);
  expect(item.x + item.width).toBeLessThanOrEqual(region.x + region.width + 1);
}

test("ui.context-tabs-3", async ({ page, isolatedWorker, navigationRun }) => {
  await navigationRun(async () => {
    const data = await fixture(isolatedWorker.database.owner);
    await identify(page, isolatedWorker, data.users[1].id);
    const paths = [
      "profile",
      "preferences",
      "accounts",
      "security",
      "authorizations",
      "danger",
    ].map((name) => `/account/settings/${name}`);
    for (const width of [1280, 390, 280]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(paths.at(-1) ?? "");
      const nav = page.getByTestId("detail-section-nav");
      const viewport = nav.locator('[data-slot="sidebar-content"]');
      const links = nav.getByRole("link");
      await expect(links).toHaveCount(paths.length);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
        "href",
        paths.at(-1) ?? "",
      );
      await expect
        .poll(async () => {
          const a = await nav.locator('[aria-current="page"]').boundingBox();
          const b = await viewport.boundingBox();
          return Boolean(
            a && b && a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1,
          );
        })
        .toBe(true);
      const boxes = await links.evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = node.getBoundingClientRect();
          return { x: box.x, y: box.y };
        }),
      );
      if (width < 1024) {
        expect(
          Math.max(...boxes.map((box) => box.y)) -
            Math.min(...boxes.map((box) => box.y)),
        ).toBeLessThan(2);
        expect(
          await viewport.evaluate(
            (node) => node.scrollWidth - node.clientWidth,
          ),
        ).toBeGreaterThan(100);
        expect(
          await viewport.evaluate((node) => node.scrollLeft),
        ).toBeGreaterThan(0);
      } else {
        expect(
          Math.max(...boxes.map((box) => box.x)) -
            Math.min(...boxes.map((box) => box.x)),
        ).toBeLessThan(2);
        expect(
          Math.max(...boxes.map((box) => box.y)) -
            Math.min(...boxes.map((box) => box.y)),
        ).toBeGreaterThan(100);
      }
      await links.first().focus();
      await insideHorizontalViewport(links.first(), viewport);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`${paths[0]}$`));
      for (let index = 0; index < paths.length; index++) {
        const active = nav.locator('[aria-current="page"]');
        await expect(active).toHaveCount(1);
        await expect(active).toHaveAttribute("href", paths[index]);
        await expect(
          page.locator("[data-settings-active-panel]"),
        ).toBeVisible();
        await insideHorizontalViewport(active, viewport);
        if (index + 1 < paths.length) {
          await active.focus();
          await page.keyboard.press("Tab");
          const next = nav.locator(`a[href="${paths[index + 1]}"]`);
          await expect(next).toBeFocused();
          await insideHorizontalViewport(next, viewport);
          if (width === 390 && index === 1)
            await page.screenshot({
              path: test
                .info()
                .outputPath("life-spec-business-context-nav-after390.png"),
              fullPage: true,
            });
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(new RegExp(`${paths[index + 1]}$`));
        }
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });
});

diagnosticTest(
  "ui.navigation-landmarks-6",
  async ({ page, isolatedWorker, navigationRun }) => {
    await navigationRun(async () => {
      for (const width of [1280, 390]) {
        const data = await fixture(isolatedWorker.database.owner);
        await page.setViewportSize({ width, height: 1000 });
        for (const owner of [0, 1]) {
          await identify(page, isolatedWorker, data.users[owner].id);
          await page.goto("/terms");
          const shell = await sidebar(page, width);
          const publicNotices = shell.locator('a[href="/news"]');
          const reminders = shell.locator(
            'a[href="/workspace/subscriptions/activities?view=notifications"]',
          );
          await expect(publicNotices).toBeVisible();
          await expect(reminders).toBeVisible();
          await expect(publicNotices).toHaveAccessibleName("News & Notices");
          await expect(reminders).toHaveAccessibleName("Activity reminders");
          const badge = reminders
            .locator("..")
            .locator('[data-slot="sidebar-menu-badge"]');
          await expect(badge).toHaveText(String(owner === 0 ? 2 : 1));
          await expect(
            publicNotices
              .locator("..")
              .locator('[data-slot="sidebar-menu-badge"]'),
          ).toHaveCount(0);
          await reminders.click();
          await expect(page).toHaveURL(
            /\/workspace\/subscriptions\/activities\?view=notifications$/,
          );
          const main = page.locator("#main-content");
          const own = data.notices.filter(
            (notice) => notice.userId === data.users[owner].id,
          );
          for (const notice of own) {
            const item = main.getByRole("link", {
              name: notice.title,
              exact: true,
            });
            if (notice.expiresAt && notice.expiresAt.getTime() < Date.now())
              await expect(item).toHaveCount(0);
            else await expect(item).toBeVisible();
          }
          for (const notice of data.notices.filter(
            (notice) => notice.userId !== data.users[owner].id,
          ))
            await expect(
              main.getByRole("link", { name: notice.title, exact: true }),
            ).toHaveCount(0);
          const db = isolatedWorker.database.owner;
          const before = await db.youngNotification.findMany({
            orderBy: { id: "asc" },
          });
          const [marked] = await Promise.all([
            page.waitForResponse(
              (response) =>
                response.request().method() === "POST" &&
                /^\/api\/workspace\/young-notifications\/[^/]+\/read$/.test(
                  new URL(response.url()).pathname,
                ),
            ),
            main
              .getByRole("button", { name: "Mark read", exact: true })
              .first()
              .click(),
          ]);
          expect(marked.status()).toBe(200);
          const result = await marked.json();
          expect(result).toEqual({ id: expect.any(String), success: true });
          expect(
            before.find((notice) => notice.id === result.id),
          ).toMatchObject({
            userId: data.users[owner].id,
            readAt: null,
          });
          expect(
            await db.youngNotification.findMany({ orderBy: { id: "asc" } }),
          ).toEqual(
            before.map((notice) =>
              notice.id === result.id
                ? { ...notice, readAt: expect.any(Date) }
                : notice,
            ),
          );
          await expect(
            main.getByRole("button", { name: "Mark read", exact: true }),
          ).toHaveCount(owner === 0 ? 1 : 0);
          const updatedShell = await sidebar(page, width);
          const updatedBadge = updatedShell
            .locator(
              'a[href="/workspace/subscriptions/activities?view=notifications"]',
            )
            .locator("..")
            .locator('[data-slot="sidebar-menu-badge"]');
          if (owner === 0) await expect(updatedBadge).toHaveText("1");
          else await expect(updatedBadge).toHaveCount(0);
        }
      }
    });
  },
);
