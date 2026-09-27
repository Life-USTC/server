import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("cases.content-security.destructive-actions-1", async ({
  page,
}, testInfo) => {
  const marker = `deletion-announcement-${crypto.randomUUID()}`;
  const owner = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Comment deletion owner",
        username: `da${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
      },
    }),
  );
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(owner.id)]);
    expect(
      (
        await page.request.post("/api/account/preferences", {
          data: { locale: "en-us" },
        })
      ).status(),
    ).toBe(200);
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: DEV_SEED.section.jwId,
        body: marker,
      },
    });
    expect(created.status()).toBe(201);
    const body = await created.json();
    const commentId = body.id;
    expect(commentId).toEqual(expect.any(String));
    await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
    const comment = page.locator(`#comment-${commentId}`);
    await expect(comment).toContainText(marker);
    await comment
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
    const unchanged = async () => {
      await expect(comment).toContainText(marker);
      expect(
        await withE2ePrisma((db) =>
          db.comment.findUnique({
            where: { id: commentId },
            select: { status: true },
          }),
        ),
      ).toEqual({ status: "active" });
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Comment deleted" }),
      ).toHaveCount(0);
    };
    // A newly persisted suspension revokes writes after the deletion dialog opens.
    const suspension = await withE2ePrisma((db) =>
      db.userSuspension.create({ data: { userId: owner.id, reason: marker } }),
    );
    const refused = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/community/comments/${commentId}`) &&
        response.request().method() === "DELETE",
    );
    await confirm.click();
    expect((await refused).status()).toBe(403);
    await page.screenshot({
      path: testInfo.outputPath("comment-deletion-refused.png"),
      fullPage: true,
    });
    await expect(dialog.getByRole("alert")).toHaveText("Couldn't post comment");
    await unchanged();
    await withE2ePrisma((db) =>
      db.userSuspension.delete({ where: { id: suspension.id } }),
    );
    await page.route(
      `**/api/community/comments/${commentId}`,
      (route) => route.abort("failed"),
      { times: 1 },
    );
    await confirm.click();
    await expect(dialog.getByRole("alert")).toHaveText("Failed to fetch");
    await unchanged();
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .locator('[data-sonner-toast][aria-live="polite"][aria-atomic="true"]')
        .filter({ hasText: "Comment deleted" }),
    ).toBeVisible();
    await expect(comment).toHaveCount(0);
    expect(
      await withE2ePrisma((db) =>
        db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ),
    ).toEqual({ status: "deleted" });
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: owner.id } });
      await db.comment.deleteMany({ where: { userId: owner.id } });
      await db.user.delete({ where: { id: owner.id } });
    });
  }
});

test("cases.content-security.destructive-actions-2", async ({ page }) => {
  const marker = `suspension-announcement-${crypto.randomUUID()}`;
  const users = await withE2ePrisma(async (db) => {
    const admin = await db.user.create({
      data: {
        name: "Suspension operator",
        username: `sa${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}-admin@example.test`,
        isAdmin: true,
      },
    });
    const target = await db.user.create({
      data: {
        name: marker,
        username: `st${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}-target@example.test`,
      },
    });
    return { admin, target };
  });
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(users.admin.id)]);
    expect(
      (
        await page.request.post("/api/account/preferences", {
          data: { locale: "en-us" },
        })
      ).status(),
    ).toBe(200);
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
        await withE2ePrisma((db) =>
          db.userSuspension.count({ where: { userId: users.target.id } }),
        ),
      ).toBe(0);
    };
    await unchanged();

    // Authorization can disappear after the administrator opens the dialog.
    await withE2ePrisma((db) =>
      db.user.update({
        where: { id: users.admin.id },
        data: { isAdmin: false },
      }),
    );
    const refused = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/admin/suspensions") &&
        response.request().method() === "POST",
    );
    await suspend.click();
    expect((await refused).status()).toBe(401);
    await expect(dialog.getByRole("alert")).toHaveText("Unauthorized");
    await unchanged();
    await withE2ePrisma((db) =>
      db.user.update({
        where: { id: users.admin.id },
        data: { isAdmin: true },
      }),
    );

    await page.route(
      "**/api/admin/suspensions",
      (route) => route.abort("failed"),
      { times: 1 },
    );
    await suspend.click();
    await expect(dialog.getByRole("alert")).toHaveText("Suspension failed");
    await unchanged();

    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let intercepted!: () => void;
    const started = new Promise<void>((resolve) => {
      intercepted = resolve;
    });
    await page.route(
      "**/api/admin/suspensions",
      async (route) => {
        intercepted();
        await pending;
        await route.continue();
      },
      { times: 1 },
    );
    await suspend.click();
    await started;
    try {
      await expect(
        dialog.getByRole("button", { name: "Suspending", exact: false }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole("button", { name: "Update suspension", exact: true }),
      ).toHaveCount(0);
      expect(
        await withE2ePrisma((db) =>
          db.userSuspension.count({ where: { userId: users.target.id } }),
        ),
      ).toBe(0);
    } finally {
      release();
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
      await withE2ePrisma((db) =>
        db.userSuspension.findMany({
          where: { userId: users.target.id },
          select: { reason: true },
        }),
      ),
    ).toEqual([{ reason: marker }]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: users.admin.id } });
      await db.user.deleteMany({
        where: { id: { in: [users.admin.id, users.target.id] } },
      });
    });
  }
});

test("cases.content-security.destructive-actions-3", async ({ page }) => {
  const marker = `moderation-announcement-${crypto.randomUUID()}`;
  const admin = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Comment moderation operator",
        username: `ma${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
        isAdmin: true,
      },
    }),
  );
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(admin.id)]);
    expect(
      (
        await page.request.post("/api/account/preferences", {
          data: { locale: "en-us" },
        })
      ).status(),
    ).toBe(200);
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: DEV_SEED.section.jwId,
        body: marker,
      },
    });
    expect(created.status()).toBe(201);
    const { id: commentId } = await created.json();
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
        await withE2ePrisma((db) =>
          db.comment.findUnique({
            where: { id: commentId },
            select: { status: true },
          }),
        ),
      ).toEqual({ status: "active" });
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "Comment updated" }),
      ).toHaveCount(0);
    };
    await unchanged();
    await withE2ePrisma((db) =>
      db.user.update({ where: { id: admin.id }, data: { isAdmin: false } }),
    );
    const refused = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/admin/comments/${commentId}`) &&
        response.request().method() === "PATCH",
    );
    await confirm.click();
    expect((await refused).status()).toBe(401);
    await expect(dialog.getByRole("alert")).toHaveText("Unauthorized");
    await unchanged();
    await withE2ePrisma((db) =>
      db.user.update({ where: { id: admin.id }, data: { isAdmin: true } }),
    );
    await page.route(
      `**/api/admin/comments/${commentId}`,
      (route) => route.abort("failed"),
      { times: 1 },
    );
    await confirm.click();
    await expect(dialog.getByRole("alert")).toHaveText("Failed to fetch");
    await unchanged();

    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let intercepted!: () => void;
    const started = new Promise<void>((resolve) => {
      intercepted = resolve;
    });
    await page.route(
      `**/api/admin/comments/${commentId}`,
      async (route) => {
        intercepted();
        await pending;
        await route.continue();
      },
      { times: 1 },
    );
    await confirm.click();
    await started;
    try {
      await expect(
        dialog.getByRole("button", { name: "Saving", exact: false }),
      ).toBeDisabled();
      await unchanged();
    } finally {
      release();
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
      await withE2ePrisma((db) =>
        db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ),
    ).toEqual({ status: "softbanned" });
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({ where: { userId: admin.id } });
      await db.comment.deleteMany({ where: { userId: admin.id } });
      await db.user.delete({ where: { id: admin.id } });
    });
  }
});
