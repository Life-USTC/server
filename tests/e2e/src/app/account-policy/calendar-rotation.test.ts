import { expect } from "@playwright/test";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as workerTest } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { withSettledPageWrites } from "../../../utils/settled-page-writes";

const url = "/account/settings/security";
const test = workerTest.extend<{
  calendarRun: (work: () => Promise<void>) => Promise<void>;
}>({
  calendarRun: async ({ page, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withSettledPageWrites(
              page,
              (target) => target.pathname === url,
              () => workflow.body(work),
            ),
          ),
        ),
      );
    });
  },
});

test("user.calendar-rotation-recent-auth", { tag: "@Calendar/Web" }, async ({
  page,
  isolatedWorker,
  calendarRun,
}) => {
  await calendarRun(async () => {
    const db = isolatedWorker.database.owner;
    const oldToken = crypto.randomUUID();
    const user = await db.user.create({
      data: {
        name: "Calendar owner",
        username: `rot${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `rotate-${crypto.randomUUID()}@example.test`,
        calendarFeedToken: oldToken,
      },
    });
    const token = async () =>
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .calendarFeedToken;
    async function session(
      age: number,
      state: "valid" | "expired" | "revoked" = "valid",
    ) {
      await page.context().clearCookies();
      const { cookie } = await isolatedWorker.createSession(user.id);
      const sessionToken = decodeURIComponent(cookie.value).split(".")[0];
      await db.$transaction(async (tx) => {
        await tx.session.deleteMany({
          where: { userId: user.id, sessionToken: { not: sessionToken } },
        });
        if (state === "revoked")
          await tx.session.delete({ where: { sessionToken } });
        else
          await tx.session.update({
            where: { sessionToken },
            data: {
              createdAt: new Date(Date.now() - age),
              ...(state === "expired"
                ? { expires: new Date(Date.now() - 60_000) }
                : {}),
            },
          });
      });
      await page
        .context()
        .addCookies([
          cookie,
          { name: "NEXT_LOCALE", value: "en-us", url: cookie.url },
        ]);
    }
    for (const state of [
      "stale",
      "future",
      "expired",
      "revoked",
      "missing",
    ] as const) {
      await session(
        state === "stale" ? 960_000 : state === "future" ? -60_000 : 60_000,
        state === "expired" || state === "revoked" ? state : "valid",
      );
      if (state === "missing") await page.context().clearCookies();
      const response = await page.request.post(`${url}?/rotateCalendarToken`, {
        form: {},
        maxRedirects: 0,
        headers: { accept: "text/html" },
      });
      if (state === "stale" || state === "future")
        expect(response.status()).toBe(403);
      else {
        expect(response.status()).toBe(303);
        expect(response.headers().location).toContain("/account/sign-in");
      }
      expect(await token()).toBe(oldToken);
    }
    await session(960_000);
    await gotoAndWaitForReady(page, url);
    const confirm = async () => {
      await page
        .getByRole("button", {
          name: "Rotate private calendar link",
          exact: true,
        })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Rotate link", exact: true })
        .click();
    };
    await confirm();
    await expect(page.getByRole("alert")).toContainText(
      "sign out and sign in again",
    );
    expect(await token()).toBe(oldToken);
    await session(60_000);
    await gotoAndWaitForReady(page, url);
    await confirm();
    await expect(page).toHaveURL(/message=CalendarTokenRotated/);
    await expect(
      page.getByText("Calendar link rotated", { exact: true }),
    ).toBeVisible();
    const newToken = await token();
    expect(newToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newToken).not.toBe(oldToken);
    const oldFeed = await page.request.get(
      `/api/calendar-feeds/${user.id}:${oldToken}.ics`,
    );
    expect(oldFeed.status()).toBe(410);
    const newFeed = await page.request.get(
      `/api/calendar-feeds/${user.id}:${newToken}.ics`,
    );
    expect(newFeed.status()).toBe(200);
    expect(await newFeed.text()).toContain("BEGIN:VCALENDAR");
  });
});
