import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("comment.public-permission-recovery", async ({ page }) => {
  test.setTimeout(90_000);
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Comment permission recovery",
        username: `cg${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${crypto.randomUUID()}@example.test`,
      },
    }),
  );
  const teacher = await withE2ePrisma((db) =>
    db.teacher.findUniqueOrThrow({ where: { jwId: DEV_SEED.teacher.jwId } }),
  );
  let release = () => {};
  try {
    await page.context().clearCookies();
    await page
      .context()
      .addCookies([
        await createSignedSessionCookie(user.id),
        { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
      ]);
    for (const path of [
      `/catalog/courses/${DEV_SEED.course.jwId}`,
      `/catalog/sections/${DEV_SEED.section.jwId}`,
      `/catalog/teachers/${teacher.id}`,
    ]) {
      let entered = () => {};
      const reading = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let failRead = true;
      let denyWrite = true;
      let writes = 0;
      await page.route("**/api/community/comments?**", async (route) => {
        if (failRead) {
          entered();
          await held;
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Unable to load comments." }),
          });
        } else await route.continue();
      });
      await page.route("**/api/community/comments", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        writes++;
        if (!denyWrite) return route.continue();
        const response = await route.fetch({
          headers: { ...route.request().headers(), cookie: "" },
        });
        expect(response.status()).toBe(401);
        await route.fulfill({ response });
      });
      await page.goto(path);
      await reading;
      const post = page.getByRole("button", {
        name: "Post comment",
        exact: true,
      });
      await expect(post).toHaveCount(0);
      expect(writes).toBe(0);
      release();
      const alert = page
        .getByRole("alert")
        .filter({ hasText: "Unable to load comments." });
      await expect(alert).toBeVisible();
      if (
        process.env.COMMENT_GATE_SCREENSHOT &&
        path.startsWith("/catalog/courses/")
      )
        await alert
          .locator("..")
          .screenshot({ path: process.env.COMMENT_GATE_SCREENSHOT });
      const retry = alert.getByRole("button", { name: "Retry", exact: true });
      await expect(retry).toBeEnabled();
      await expect(post).toBeDisabled();
      failRead = false;
      await retry.click();
      await expect(post).toBeEnabled();
      await expect(alert).toHaveCount(0);
      expect(writes).toBe(0);
      await post.click();
      const body = `Recovered comment ${crypto.randomUUID()}`;
      await page
        .getByRole("textbox", { name: "Comment body", exact: true })
        .fill(body);
      const before = await withE2ePrisma((db) =>
        db.comment.findMany({ where: { userId: user.id } }),
      );
      const rejected = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/community/comments" &&
          r.request().method() === "POST" &&
          r.status() === 401,
      );
      await post.click();
      await rejected;
      await expect(post).toBeEnabled();
      await expect(
        page.getByRole("textbox", { name: "Comment body", exact: true }),
      ).toHaveValue(body);
      expect(
        await withE2ePrisma((db) =>
          db.comment.findMany({ where: { userId: user.id } }),
        ),
      ).toEqual(before);
      expect(writes).toBe(1);
      denyWrite = false;
      const saved = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === "/api/community/comments" &&
          r.request().method() === "POST" &&
          r.status() === 201,
      );
      await post.click();
      const response = await saved;
      const result = await response.json();
      await expect(page.locator(`#comment-${result.id}`)).toContainText(body);
      expect(writes).toBe(2);
      expect(
        await withE2ePrisma((db) =>
          db.comment.count({ where: { userId: user.id, body } }),
        ),
      ).toBe(1);
      await page.unrouteAll({ behavior: "wait" });
    }
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
      });
      await db.comment.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    });
  }
});
