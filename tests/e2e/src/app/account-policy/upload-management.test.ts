import { expect, type Page } from "@playwright/test";
import { formatBytes } from "@/shared/lib/format-bytes";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { observeAction } from "../../../utils/observed-action";
import { test as workerTest } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { withSettledPageWrites } from "../../../utils/settled-page-writes";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { assertPageContract } from "../_shared/page-contract";

type UploadManagement = {
  user: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  db: IsolatedWorker["database"]["owner"];
  sectionJwId: number;
  sectionId: number;
  quotaLabel: string;
  bucket: ReturnType<typeof createUploadBucket>;
  objects: Map<string, string>;
  upload: (filename?: string) => Promise<string>;
};

const test = workerTest.extend<{
  owned: UploadManagement;
  uploadRun: (work: () => Promise<void>) => Promise<void>;
}>({
  owned: async ({ isolatedWorker, request, run }, use) => {
    await use(
      await run(async () => {
        const db = isolatedWorker.database.owner;
        const user = await isolatedWorker.createActor();
        const section = await db.$transaction(async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { name: "Upload management owner" },
          });
          const semester = await tx.semester.create({
            data: {
              jwId: 1_840_000_000,
              code: "UPLOAD-MANAGEMENT",
              nameCn: "上传测试学期",
              startDate: new Date(Date.now() - 30 * 86_400_000),
              endDate: new Date(Date.now() + 180 * 86_400_000),
            },
          });
          const course = await tx.course.create({
            data: {
              jwId: 1_840_000_000,
              code: "UPLOAD-MANAGEMENT",
              nameCn: "Upload management course",
            },
          });
          return tx.section.create({
            data: {
              jwId: 1_840_000_000,
              code: "UPLOAD-MANAGEMENT-01",
              courseId: course.id,
              semesterId: semester.id,
            },
          });
        });
        const bucket = createUploadBucket(request, isolatedWorker.origin);
        const objects = new Map<string, string>();
        return {
          user,
          db,
          sectionJwId: section.jwId,
          sectionId: section.id,
          quotaLabel: "",
          bucket,
          objects,
          upload: (filename = "lecture-notes.txt") =>
            run(async () => {
              const result = await createUploadedFileViaApi(user.request, {
                filename,
                contents: "Learning material",
              });
              objects.set(result.uploadId, result.key);
              const stored = await bucket.get(result.key);
              expect(stored).not.toBeNull();
              expect(stored?.body).toEqual(
                new TextEncoder().encode("Learning material"),
              );
              return result.uploadId;
            }),
        };
      }),
    );
  },
  uploadRun: async ({ page, isolatedWorker, owned, run }, use) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withSettledPageWrites(
              page,
              (url) => url.origin === isolatedWorker.origin,
              () =>
                workflow.body(async () => {
                  await page.context().addCookies([owned.user.cookie]);
                  const locale = await page.request.post(
                    "/api/account/preferences",
                    { data: { locale: "en-us" } },
                  );
                  expect(locale.status()).toBe(200);
                  await locale.body();
                  const response = await page.request.get(
                    "/api/workspace/uploads",
                  );
                  expect(response.status()).toBe(200);
                  const { meta } = await response.json();
                  owned.quotaLabel = formatBytes(meta.quotaBytes);
                  await work();
                }),
              async (response, request) => {
                await response.body();
                const id = new URL(request.url()).pathname.match(
                  /^\/api\/workspace\/uploads\/([^/]+)$/,
                )?.[1];
                if (
                  id &&
                  request.method() === "DELETE" &&
                  response.status() === 200
                ) {
                  const key = owned.objects.get(id);
                  if (!key)
                    throw new Error("Deleted upload has no owned storage key");
                  expect(await owned.bucket.get(key)).toBeNull();
                }
              },
            ),
          ),
        ),
      );
    });
  },
});

const visibleRows = (page: Page) => page.locator("tbody:visible tr");

test("upload.web-list", async ({
  page,
  request,
  owned,
  uploadRun,
}, testInfo) => {
  await uploadRun(async () => {
    const other = await owned.db.$transaction((db) =>
      db.user.create({
        data: {
          name: "Other upload owner",
          email: `${crypto.randomUUID()}@example.test`,
        },
      }),
    );
    const signedOut = await request.get("/workspace/uploads?page=2", {
      maxRedirects: 0,
    });
    expect(signedOut.status()).toBe(303);
    expect(signedOut.headers().location).toBe(
      "/account/sign-in?callbackUrl=%2Fworkspace%2Fuploads%3Fpage%3D2",
    );
    await owned.db.$transaction(async (db) => {
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
  });
});

test("upload.web-rename", async ({ page, owned, uploadRun }) => {
  await uploadRun(async () => {
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
    const suspension = await owned.db.$transaction((db) =>
      db.userSuspension.create({
        data: {
          userId: owned.user.id,
          reason: "Test current write authorization",
        },
      }),
    );
    const rejected = await observeAction(
      () =>
        page.waitForResponse(
          (r) =>
            r.url().endsWith(`/api/workspace/uploads/${id}`) &&
            r.request().method() === "PATCH",
        ),
      () => save.click(),
    );
    expect(rejected.status()).toBe(403);
    await expect(dialog.getByRole("alert")).toHaveText(
      "We couldn't rename the file.",
    );
    expect(
      await owned.db.$transaction((db) =>
        db.upload.findUnique({ where: { id }, select: { filename: true } }),
      ),
    ).toEqual({ filename: "lecture-notes.txt" });
    await owned.db.$transaction((db) =>
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
  });
});

test("upload.web-delete-feedback", async ({
  page,
  owned,
  uploadRun,
}, testInfo) => {
  await uploadRun(async () => {
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
    const suspension = await owned.db.$transaction((db) =>
      db.userSuspension.create({
        data: {
          userId: owned.user.id,
          reason: "Test current write authorization",
        },
      }),
    );
    const rejected = await observeAction(
      () =>
        page.waitForResponse(
          (r) =>
            r.url().endsWith(`/api/workspace/uploads/${id}`) &&
            r.request().method() === "DELETE",
        ),
      () => confirm.click(),
    );
    expect(rejected.status()).toBe(403);
    await expect(dialog.getByRole("alert")).toHaveText(
      "We couldn't delete the file.",
    );
    expect(
      await owned.db.$transaction((db) => db.upload.count({ where: { id } })),
    ).toBe(1);
    expect(
      await (
        await page.request.get(`/api/workspace/uploads/${id}/download`)
      ).text(),
    ).toBe("Learning material");
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "File deleted" }),
    ).toHaveCount(0);
    await owned.db.$transaction((db) =>
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
  });
});

test("cases.content-security.deletion-confirmation", async ({
  page,
  owned,
  uploadRun,
}) => {
  await uploadRun(async () => {
    const id = await owned.upload();
    const { id: commentId } = await owned.db.comment.create({
      data: {
        userId: owned.user.id,
        sectionId: owned.sectionId,
        body: "Deletion confirmation fixture",
      },
    });
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
      await owned.db.$transaction((db) => db.upload.count({ where: { id } })),
    ).toBe(1);
    await openUpload();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toHaveLength(1);
    expect(
      await owned.db.$transaction((db) => db.upload.count({ where: { id } })),
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
      await owned.db.$transaction((db) =>
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
      await owned.db.$transaction((db) =>
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
      await owned.db.$transaction((db) =>
        db.user.count({ where: { id: owned.user.id } }),
      ),
    ).toBe(1);
    await openAccount();
    await dialog.getByPlaceholder("DELETE").fill("DELETE");
    await dialog.getByRole("button", { name: /Delete/i }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(requests).toHaveLength(1);
    expect(
      await owned.db.$transaction((db) =>
        db.user.count({ where: { id: owned.user.id } }),
      ),
    ).toBe(0);
  });
});

test("upload.comment-attachments-only", async ({
  page,
  request,
  owned,
  uploadRun,
}) => {
  await uploadRun(async () => {
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
      `/catalog/sections/${owned.sectionJwId}#comments`,
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
      await owned.db.$transaction((db) =>
        db.commentAttachment.count({ where: { uploadId } }),
      ),
    ).toBe(0);
  });
});
