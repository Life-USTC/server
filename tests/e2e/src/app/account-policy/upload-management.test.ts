import { expect, type Page, test } from "@playwright/test";
import { formatBytes } from "@/shared/lib/format-bytes";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";
import { assertPageContract } from "../_shared/page-contract";

async function fixture(page: Page) {
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Upload management owner",
        username: `um${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${crypto.randomUUID()}@example.test`,
        emailVerified: true,
      },
    }),
  );
  await page.context().addCookies([await createSignedSessionCookie(user.id)]);
  expect(
    (
      await page.request.post("/api/account/preferences", {
        data: { locale: "en-us" },
      })
    ).status(),
  ).toBe(200);
  const { meta } = await (
    await page.request.get("/api/workspace/uploads")
  ).json();
  const quotaLabel = formatBytes(meta.quotaBytes);
  const objects: string[] = [];
  return {
    user,
    quotaLabel,
    async upload(filename = "lecture-notes.txt") {
      const result = await createUploadedFileViaApi(page.request, {
        filename,
        contents: "Learning material",
      });
      objects.push(result.uploadId);
      return result.uploadId;
    },
    async cleanup() {
      await withE2ePrisma((db) =>
        db.userSuspension.deleteMany({ where: { userId: user.id } }),
      );
      for (const id of objects) {
        const exists = await withE2ePrisma((db) =>
          db.upload.count({ where: { id } }),
        );
        if (exists)
          expect(
            (
              await page.request.delete(`/api/workspace/uploads/${id}`)
            ).status(),
          ).toBe(200);
      }
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({
          where: {
            OR: [
              { userId: user.id },
              { subjectUserId: user.id },
              { targetId: user.id },
            ],
          },
        });
        await db.comment.deleteMany({ where: { userId: user.id } });
        await db.user.deleteMany({ where: { id: user.id } });
      });
    },
  };
}

const visibleRows = (page: Page) => page.locator("tbody:visible tr");

test("upload.web-list", async ({ page, request }, testInfo) => {
  const owned = await fixture(page);
  const other = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Other upload owner",
        email: `${crypto.randomUUID()}@example.test`,
      },
    }),
  );
  try {
    const signedOut = await request.get("/workspace/uploads?page=2", {
      maxRedirects: 0,
    });
    expect(signedOut.status()).toBe(303);
    expect(signedOut.headers().location).toBe(
      "/account/sign-in?callbackUrl=%2Fworkspace%2Fuploads%3Fpage%3D2",
    );
    await withE2ePrisma(async (db) => {
      for (let index = 0; index < 21; index++)
        await db.upload.create({
          data: {
            userId: owned.user.id,
            key: `uploads/${owned.user.id}/${index}`,
            filename: `material-${String(index).padStart(2, "0")}.txt`,
            size: 1024,
            contentType: "text/plain",
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
          },
        });
      await db.upload.create({
        data: {
          userId: other.id,
          key: `uploads/${other.id}/private`,
          filename: "other-private-file.txt",
          size: 7,
          contentType: "text/plain",
        },
      });
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto("/workspace/uploads");
    expect(response?.headers()["cache-control"]).toContain("private, no-store");
    await assertPageContract(page, {
      routePath: "/workspace/uploads",
      testInfo,
    });
    await expect(
      page.getByRole("heading", { name: "My Uploads", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "My Uploads", exact: true }),
    ).toBeVisible();
    await expect(visibleRows(page)).toHaveCount(20);
    await expect(visibleRows(page).first()).toContainText("material-20.txt");
    await expect(visibleRows(page).first()).toContainText("1.0 KB");
    await expect(visibleRows(page).first().locator("time")).toHaveAttribute(
      "datetime",
      "2026-01-01T00:20:00.000Z",
    );
    await expect(visibleRows(page).first().locator("time")).toContainText(
      "8:20",
    );
    await expect(
      page.getByText(`21 KB of ${owned.quotaLabel} used`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Up to 50 MB per file", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("other-private-file.txt", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("uploads-desktop-after.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "Next page", exact: true }).click();
    await expect(page).toHaveURL(/page=2$/);
    await expect(visibleRows(page)).toHaveCount(1);
    await expect(visibleRows(page).first()).toContainText("material-00.txt");
    await page.goto("/workspace/uploads?page=900");
    await expect(page).toHaveURL(/page=2$/);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/overview");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("link", { name: "My Uploads", exact: true }).click();
    await expect(page).toHaveURL(/\/workspace\/uploads$/);
    await assertPageContract(page, {
      routePath: "/workspace/uploads",
      testInfo,
    });
    await expect(
      page.getByRole("listitem").filter({ hasText: "material-20.txt" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("uploads-mobile-after.png"),
      fullPage: true,
    });
    expect(
      (
        await page.request.post("/api/account/preferences", {
          data: { locale: "zh-cn" },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "我的上传", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重命名 material-20.txt", exact: true }),
    ).toBeVisible();
  } finally {
    await owned.cleanup();
    await withE2ePrisma((db) => db.user.delete({ where: { id: other.id } }));
  }
});

test("upload.web-rename", async ({ page }) => {
  const owned = await fixture(page);
  try {
    const id = await owned.upload();
    await gotoAndWaitForReady(page, "/workspace/uploads");
    await page
      .getByRole("button", { name: "Rename lecture-notes.txt", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Rename", exact: true });
    const input = dialog.getByRole("textbox", { name: "File", exact: true });
    const save = dialog.getByRole("button", { name: "Save", exact: true });
    await input.fill(" ");
    await expect(save).toBeDisabled();
    await input.fill("renamed-notes.txt");
    const suspension = await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: {
          userId: owned.user.id,
          reason: "Test current write authorization",
        },
      }),
    );
    const rejected = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/workspace/uploads/${id}`) &&
        r.request().method() === "PATCH",
    );
    await save.click();
    expect((await rejected).status()).toBe(403);
    await expect(dialog.getByRole("alert")).toHaveText(
      "We couldn't rename the file.",
    );
    expect(
      await withE2ePrisma((db) =>
        db.upload.findUnique({ where: { id }, select: { filename: true } }),
      ),
    ).toEqual({ filename: "lecture-notes.txt" });
    await withE2ePrisma((db) =>
      db.userSuspension.delete({ where: { id: suspension.id } }),
    );
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Rename renamed-notes.txt",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-sonner-toast][aria-live="polite"]')
        .filter({ hasText: "Rename complete" }),
    ).toBeVisible();
    const download = await page.request.get(
      `/api/workspace/uploads/${id}/download`,
    );
    expect(await download.text()).toBe("Learning material");
    expect(download.headers()["content-disposition"]).toContain(
      "renamed-notes.txt",
    );
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: "Rename renamed-notes.txt",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await owned.cleanup();
  }
});

test("upload.web-delete-feedback", async ({ page }, testInfo) => {
  const owned = await fixture(page);
  try {
    const id = await owned.upload();
    await gotoAndWaitForReady(page, "/workspace/uploads");
    await page
      .getByRole("button", { name: "Delete lecture-notes.txt", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Delete",
      exact: true,
    });
    const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
    const suspension = await withE2ePrisma((db) =>
      db.userSuspension.create({
        data: {
          userId: owned.user.id,
          reason: "Test current write authorization",
        },
      }),
    );
    const rejected = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/workspace/uploads/${id}`) &&
        r.request().method() === "DELETE",
    );
    await confirm.click();
    expect((await rejected).status()).toBe(403);
    await expect(dialog.getByRole("alert")).toHaveText(
      "We couldn't delete the file.",
    );
    expect(
      await withE2ePrisma((db) => db.upload.count({ where: { id } })),
    ).toBe(1);
    expect(
      await (
        await page.request.get(`/api/workspace/uploads/${id}/download`)
      ).text(),
    ).toBe("Learning material");
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "File deleted" }),
    ).toHaveCount(0);
    await withE2ePrisma((db) =>
      db.userSuspension.delete({ where: { id: suspension.id } }),
    );
    await page.screenshot({
      path: testInfo.outputPath("uploads-confirmation-after.png"),
      fullPage: true,
    });
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByText("No uploads yet", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`0 B of ${owned.quotaLabel} used`, { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-sonner-toast][aria-live="polite"]')
        .filter({ hasText: "File deleted" }),
    ).toBeVisible();
    expect(
      (
        await page.request.get(`/api/workspace/uploads/${id}/download`)
      ).status(),
    ).toBe(404);
  } finally {
    await owned.cleanup();
  }
});

test("cases.content-security.deletion-confirmation", async ({ page }) => {
  const owned = await fixture(page);
  try {
    const id = await owned.upload();
    const created = await page.request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: DEV_SEED.section.jwId,
        body: "Deletion confirmation fixture",
      },
    });
    expect(created.status()).toBe(201);
    const { id: commentId } = await created.json();
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "DELETE" || r.url().includes("?/deleteAccount"))
        requests.push(r.url());
    });
    await gotoAndWaitForReady(page, "/workspace/uploads");
    const openUpload = () =>
      page
        .getByRole("button", { name: "Delete lecture-notes.txt", exact: true })
        .click();
    await openUpload();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("permanently removes the file");
    await expect(
      dialog.getByRole("button", { name: "Delete", exact: true }),
    ).toBeEnabled();
    expect(requests).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(
      await withE2ePrisma((db) => db.upload.count({ where: { id } })),
    ).toBe(1);
    await openUpload();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toHaveLength(1);
    expect(
      await withE2ePrisma((db) => db.upload.count({ where: { id } })),
    ).toBe(0);
    requests.length = 0;
    await gotoAndWaitForReady(page, `/community/comments/${commentId}`);
    const comment = page.locator(`#comment-${commentId}`);
    const openComment = async () => {
      await comment
        .getByRole("button", { name: "More actions", exact: true })
        .click();
      await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    };
    await openComment();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-slot="alert-dialog-description"]'),
    ).toContainText("This action cannot be undone.");
    expect(requests).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toEqual([]);
    await expect(comment).toContainText("Deletion confirmation fixture");
    expect(
      await withE2ePrisma((db) =>
        db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ),
    ).toEqual({ status: "active" });
    await openComment();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toHaveLength(1);
    expect(
      await withE2ePrisma((db) =>
        db.comment.findUnique({
          where: { id: commentId },
          select: { status: true },
        }),
      ),
    ).toEqual({ status: "deleted" });
    requests.length = 0;
    await gotoAndWaitForReady(page, "/account/settings/danger");
    const openAccount = () =>
      page
        .locator("[data-settings-danger-region]")
        .getByRole("button", { name: /Delete/i })
        .click();
    await openAccount();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.locator('[data-slot="alert-dialog-description"]'),
    ).toContainText("This action cannot be undone.");
    await dialog.getByPlaceholder("DELETE").fill("DELETE");
    expect(requests).toEqual([]);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toEqual([]);
    expect(
      await withE2ePrisma((db) =>
        db.user.count({ where: { id: owned.user.id } }),
      ),
    ).toBe(1);
    await openAccount();
    await dialog.getByPlaceholder("DELETE").fill("DELETE");
    await dialog.getByRole("button", { name: /Delete/i }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(requests).toHaveLength(1);
    expect(
      await withE2ePrisma((db) =>
        db.user.count({ where: { id: owned.user.id } }),
      ),
    ).toBe(0);
  } finally {
    await owned.cleanup();
  }
});

test("upload.comment-attachments-only", async ({ page, request }) => {
  const owned = await fixture(page);
  try {
    const uploadId = await owned.upload("comment-draft.txt");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/uploads");
      const main = page.locator("#main-content");
      await expect(main).toContainText(
        "Manage files uploaded through comment attachments.",
      );
      await expect(main.locator('input[type="file"]')).toHaveCount(0);
      await expect(
        main.getByRole("button", {
          name: /^(Upload|Share|Create public link)/i,
        }),
      ).toHaveCount(0);
      const download = main
        .getByRole("link", { name: "Open comment-draft.txt", exact: true })
        .filter({ visible: true });
      await expect(download).toHaveAttribute(
        "href",
        `/api/workspace/uploads/${uploadId}/download`,
      );
    }
    const anonymousDownload = await request.get(
      `/api/workspace/uploads/${uploadId}/download`,
    );
    expect(anonymousDownload.status()).toBe(401);
    const ownerDownload = await page.request.get(
      `/api/workspace/uploads/${uploadId}/download`,
    );
    expect(ownerDownload.status()).toBe(200);
    expect(await ownerDownload.text()).toBe("Learning material");
    await gotoAndWaitForReady(
      page,
      `/catalog/sections/${DEV_SEED.section.jwId}#comments`,
    );
    const comments = page.locator("#comments");
    await comments
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(comments.locator('input[type="file"]')).toHaveCount(1);
    await expect(
      comments.getByRole("button", { name: /Upload file|Upload attachment/i }),
    ).toBeVisible();
    expect(
      await withE2ePrisma((db) =>
        db.commentAttachment.count({ where: { uploadId } }),
      ),
    ).toBe(0);
  } finally {
    await owned.cleanup();
  }
});
