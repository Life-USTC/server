import { expect } from "@playwright/test";
import { observeAction } from "../../../utils/observed-action";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "./destructive-security-fixture";

test("cases.content-security.destructive-actions-1", {
  tag: "@Account/Web",
}, async ({ page, deletionAnnouncementRun }) => {
  await deletionAnnouncementRun(async (f) => {
    const marker = f.marker;
    const owner = f.actor;
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "en-us" },
    });
    await localeResponse.body();
    expect(localeResponse.status()).toBe(200);
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: f.section.jwId,
        body: marker,
      },
    });
    expect(created.status()).toBe(201);
    const body = await created.json();
    const commentId = body.id;
    f.ids.comment = commentId;
    expect(commentId).toEqual(expect.any(String));
    await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
    const comment = page.locator(`#comment-${commentId}`);
    await expect(comment).toContainText(marker);
    await comment
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    const confirm = dialog.getByRole("button", {
      name: "Delete",
      exact: true,
    });
    const unchanged = async () => {
      await expect(comment).toContainText(marker);
      expect(
        await f.db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ).toEqual({ status: "active" });
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Comment deleted" }),
      ).toHaveCount(0);
    };
    // A newly persisted suspension revokes writes after the deletion dialog opens.
    const suspension = await f.db.userSuspension.create({
      data: { userId: owner.id, reason: marker },
    });
    const refused = await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/community/comments/${commentId}`) &&
            response.request().method() === "DELETE",
        ),
      () => confirm.click(),
    );
    expect(refused.status()).toBe(403);

    await expect(dialog.getByRole("alert")).toHaveText("Couldn't post comment");
    await unchanged();
    await f.db.userSuspension.delete({ where: { id: suspension.id } });
    await f.abortNextWrite();
    await confirm.click();
    await expect(dialog.getByRole("alert")).toHaveText("Failed to fetch");
    await unchanged();
    await f.clearRoutes();
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .locator('[data-sonner-toast][aria-live="polite"][aria-atomic="true"]')
        .filter({ hasText: "Comment deleted" }),
    ).toBeVisible();
    await expect(comment).toHaveCount(0);
    expect(
      await f.db.comment.findUnique({
        where: { id: commentId },
        select: { status: true },
      }),
    ).toEqual({ status: "deleted" });
  });
});

test("cases.content-security.destructive-actions-2", {
  tag: "@Account/Web",
}, async ({ page, suspensionAnnouncementRun }) => {
  await suspensionAnnouncementRun(async (f) => {
    const marker = f.marker;
    const users = { admin: f.actor, target: f.subject };
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "en-us" },
    });
    await localeResponse.body();
    expect(localeResponse.status()).toBe(200);
    await gotoAndWaitForReady(
      page,
      `/admin/users?search=${encodeURIComponent(users.target.email)}`,
    );
    const row = page.locator("tbody tr:visible").filter({ hasText: marker });
    await row.getByRole("button", { name: "Manage User", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Manage User",
      exact: true,
    });
    const suspend = dialog.getByRole("button", {
      name: "Suspend",
      exact: true,
    });
    await dialog.getByLabel("Reason", { exact: true }).fill(marker);
    const unchanged = async () => {
      await expect(suspend).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Update suspension", exact: true }),
      ).toHaveCount(0);
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Suspended successfully" }),
      ).toHaveCount(0);
      expect(
        await f.db.userSuspension.count({ where: { userId: users.target.id } }),
      ).toBe(0);
    };
    await unchanged();

    // Authorization can disappear after the administrator opens the dialog.
    await f.db.user.update({
      where: { id: users.admin.id },
      data: { isAdmin: false },
    });
    const refused = await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/admin/suspensions") &&
            response.request().method() === "POST",
        ),
      () => suspend.click(),
    );
    expect(refused.status()).toBe(401);
    await expect(dialog.getByRole("alert")).toHaveText("Unauthorized");
    await unchanged();
    await f.db.user.update({
      where: { id: users.admin.id },
      data: { isAdmin: true },
    });

    await f.abortNextWrite();
    await suspend.click();
    await expect(dialog.getByRole("alert")).toHaveText("Suspension failed");
    await unchanged();
    await f.clearRoutes();

    const held = await f.holdNextWrite();
    f.suspensionWindow.start = await page.evaluate(() => Date.now());
    await suspend.click();
    await held.started;
    f.suspensionWindow.end = await page.evaluate(() => Date.now());
    try {
      await expect(
        dialog.getByRole("button", { name: "Suspending", exact: false }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole("button", { name: "Update suspension", exact: true }),
      ).toHaveCount(0);
      expect(
        await f.db.userSuspension.count({ where: { userId: users.target.id } }),
      ).toBe(0);
    } finally {
      held.release();
    }
    const success = page
      .locator('[data-sonner-toast][aria-live="polite"][aria-atomic="true"]')
      .filter({ hasText: "Suspended successfully" });
    await expect(success).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Update suspension", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(
      await f.db.userSuspension.findMany({
        where: { userId: users.target.id },
        select: { reason: true },
      }),
    ).toEqual([{ reason: marker }]);
    await f.clearRoutes();
  });
});

test("cases.content-security.destructive-actions-3", {
  tag: "@Account/Web",
}, async ({ page, moderationAnnouncementRun }) => {
  await moderationAnnouncementRun(async (f) => {
    const marker = f.marker;
    const admin = f.actor;
    const localeResponse = await page.request.post("/api/account/preferences", {
      data: { locale: "en-us" },
    });
    await localeResponse.body();
    expect(localeResponse.status()).toBe(200);
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: f.section.jwId,
        body: marker,
      },
    });
    expect(created.status()).toBe(201);
    const { id: commentId } = await created.json();
    f.ids.comment = commentId;
    await gotoAndWaitForReady(
      page,
      `/admin/moderation?status=all&search=${encodeURIComponent(marker)}`,
    );
    const row = page.locator("tbody tr:visible").filter({ hasText: marker });
    await row
      .getByRole("button", { name: "Manage Comment", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Manage Comment",
      exact: true,
    });
    await dialog.getByRole("radio", { name: "Private", exact: true }).click();
    const confirm = dialog.getByRole("button", {
      name: "Confirm",
      exact: true,
    });
    const unchanged = async () => {
      await expect(row.getByText("Active", { exact: true })).toHaveCount(1);
      await expect(row.getByText("Private", { exact: true })).toHaveCount(0);
      expect(
        await f.db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ).toEqual({ status: "active" });
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Comment updated" }),
      ).toHaveCount(0);
    };
    await unchanged();
    await f.db.user.update({
      where: { id: admin.id },
      data: { isAdmin: false },
    });
    const refused = await observeAction(
      () =>
        page.waitForResponse(
          (response) =>
            response.url().endsWith(`/api/admin/comments/${commentId}`) &&
            response.request().method() === "PATCH",
        ),
      () => confirm.click(),
    );
    expect(refused.status()).toBe(401);
    await expect(dialog.getByRole("alert")).toHaveText("Unauthorized");
    await unchanged();
    await f.db.user.update({
      where: { id: admin.id },
      data: { isAdmin: true },
    });
    await f.abortNextWrite();
    await confirm.click();
    await expect(dialog.getByRole("alert")).toHaveText("Failed to fetch");
    await unchanged();
    await f.clearRoutes();

    const held = await f.holdNextWrite();
    await confirm.click();
    await held.started;
    try {
      await expect(
        dialog.getByRole("button", { name: "Saving", exact: false }),
      ).toBeDisabled();
      await unchanged();
    } finally {
      held.release();
    }
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .locator('[data-sonner-toast][aria-live="polite"][aria-atomic="true"]')
        .filter({ hasText: "Comment updated" }),
    ).toBeVisible();
    await expect(row.getByText("Private", { exact: true })).toBeVisible();
    await expect(row.getByText("Active", { exact: true })).toHaveCount(0);
    expect(
      await f.db.comment.findUnique({
        where: { id: commentId },
        select: { status: true },
      }),
    ).toEqual({ status: "softbanned" });
    await f.clearRoutes();
  });
});
