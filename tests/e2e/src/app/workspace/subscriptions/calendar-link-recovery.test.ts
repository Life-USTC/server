import { expect } from "@playwright/test";
import { createHomeworkAcademic } from "../../../../utils/homework-state";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/personal-preferences-fixture";

for (const route of ["/workspace/subscriptions", "/workspace/calendar"]) {
  test(
    `personal calendar link recovers an old session ${route}`,
    { tag: "@Subscription/Web" },
    async ({ page, account, isolatedWorker, preferenceFlow }, testInfo) => {
      await preferenceFlow.prepare(() =>
        isolatedWorker.database.owner.session.updateMany({
          where: { userId: account.id },
          data: { createdAt: new Date(Date.now() - 3600000) },
        }),
      );
      await preferenceFlow.run(async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, route);
          await testInfo.attach(
            `calendar-recovery-${route.split("/").pop()}-${width}`,
            {
              body: await page.screenshot({ fullPage: true }),
              contentType: "image/png",
            },
          );
          const trigger = page
            .getByRole("button", { name: "Copy iCal Link", exact: true })
            .filter({ visible: true })
            .first();
          await expect(trigger).toBeVisible();
          await trigger.click();
          const dialog = page.getByRole("dialog");
          await expect(dialog).toContainText(
            "Sign in again to reveal your private calendar link.",
          );
          const reauth = dialog.getByRole("link", {
            name: "Sign in again",
            exact: true,
          });
          await expect(reauth).toHaveAttribute(
            "href",
            `/account/sign-in?reauth=1&callbackUrl=${encodeURIComponent(route)}`,
          );
          await expect(dialog.locator("input")).toHaveCount(0);
          await page.keyboard.press("Escape");
        }
        await triggerReauthentication(page, route);
        expect(
          (
            await isolatedWorker.database.owner.user.findUniqueOrThrow({
              where: { id: account.id },
            })
          ).calendarFeedToken,
        ).toBeNull();
      });
    },
  );
}

async function triggerReauthentication(
  page: import("@playwright/test").Page,
  route: string,
) {
  await page
    .getByRole("button", { name: "Copy iCal Link", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Sign in again", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/sign-in\?reauth=1&callbackUrl=/);
  expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(route);
}

for (const route of ["/workspace/subscriptions", "/workspace/calendar"]) {
  test(`personal calendar link retries a failed token mint ${route}`, {
    tag: "@Subscription/Web",
  }, async ({ page, account, isolatedWorker, preferenceFlow }) => {
    const db = isolatedWorker.database.owner;
    const trigger = `calendar_failure_${crypto.randomUUID().replaceAll("-", "")}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(account.id))
      throw new Error("Unexpected fixture ID");
    const dropTrigger = () =>
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER IF EXISTS "${trigger}" ON "User"`,
        );
        await tx.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
      });
    await preferenceFlow.prepare(() =>
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW."id" = '${account.id}' THEN RAISE EXCEPTION 'isolated calendar failure'; END IF; RETURN NEW; END; $body$`,
        );
        await tx.$executeRawUnsafe(
          `CREATE TRIGGER "${trigger}" BEFORE UPDATE OF "calendarFeedToken" ON "User" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
        );
      }),
    );
    try {
      await preferenceFlow.run(async () => {
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
          ]);
        await gotoAndWaitForReady(page, route);
        await page
          .getByRole("button", { name: "Copy iCal Link", exact: true })
          .filter({ visible: true })
          .first()
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText(
          "The calendar link is unavailable. Try again.",
        );
        await expect(
          dialog.getByRole("link", { name: "Sign in again", exact: true }),
        ).toHaveCount(0);
        const retry = dialog.getByRole("button", {
          name: "Retry",
          exact: true,
        });
        await retry.click();
        await expect(retry).toBeEnabled();
        await expect(dialog.locator("input")).toHaveCount(0);
        expect(
          (await db.user.findUniqueOrThrow({ where: { id: account.id } }))
            .calendarFeedToken,
        ).toBeNull();
        await dropTrigger();
        await retry.click();
        await expect(dialog.locator("input")).toHaveCount(1);
        await expect
          .poll(() =>
            dialog.evaluate((element) =>
              element.contains(document.activeElement),
            ),
          )
          .toBe(true);
        const stored = await db.user.findUniqueOrThrow({
          where: { id: account.id },
        });
        expect(stored.calendarFeedToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
        const value = await dialog.locator("input").inputValue();
        expect(
          new URL(value).pathname ===
            `/api/calendar-feeds/${account.id}:${stored.calendarFeedToken}.ics`,
        ).toBe(true);
        await page.keyboard.press("Escape");
      });
    } finally {
      await dropTrigger();
    }
  });
}

test("personal calendar recovery remains available in the subscribed mobile menu", {
  tag: "@Subscription/Web",
}, async ({ page, account, isolatedWorker, preferenceFlow }) => {
  await preferenceFlow.prepare(async () => {
    const db = isolatedWorker.database.owner;
    const semester = await db.semester.create({
      data: {
        jwId: 987654,
        code: "421",
        nameCn: "2026年春季学期",
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
      },
    });
    await createHomeworkAcademic(db, account.id, semester.id);
    await db.session.updateMany({
      where: { userId: account.id },
      data: { createdAt: new Date(Date.now() - 3600000) },
    });
  });
  await preferenceFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page.setViewportSize({ width: 390, height: 900 });
    await gotoAndWaitForReady(page, "/workspace/calendar");
    await page
      .getByRole("button", { name: "More calendar actions", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: "Copy iCal Link", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Sign in again to reveal your private calendar link.",
    );
    await expect(page.getByRole("dialog").locator("input")).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(
      (
        await isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: account.id },
        })
      ).calendarFeedToken,
    ).toBeNull();
  });
});
