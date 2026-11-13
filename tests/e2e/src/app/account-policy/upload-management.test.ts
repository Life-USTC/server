import { expect, type Page } from "@playwright/test";
import { formatBytes } from "@/shared/lib/format-bytes";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { observeAction } from "../../../utils/observed-action";
import { test as workerTest } from "../../../utils/owned-worker";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { withSettledPageWrites } from "../../../utils/settled-page-writes";
import {
  expectUploadWriteState,
  type UploadState,
  type UploadWrite,
  withUploadObserver,
} from "../../../utils/upload-write-observer";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { assertPageContract } from "../_shared/page-contract";

type UploadManagement = {
  user: Awaited<ReturnType<IsolatedWorker["createActor"]>>;
  db: IsolatedWorker["database"]["owner"];
  sectionJwId: number;
  sectionId: number;
  quotaLabel: string;
  objects: Map<string, UploadState>;
  writes: UploadWrite[];
  readUpload: (id: string, key: string) => Promise<UploadState>;
  upload: (filename?: string) => Promise<string>;
  prepareUpload: () => Promise<string>;
};

const test = workerTest.extend<{
  owned: UploadManagement;
  uploadRun: (work: () => Promise<void>) => Promise<void>;
}>({
  owned: async ({ isolatedWorker, run }, use) => {
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
        const objects = new Map<string, UploadState>();
        const readUpload = (id: string, key: string) =>
          withUploadObserver(isolatedWorker.origin, async (observer) => {
            const upload = await db.upload.findUnique({ where: { id } });
            const object = await observer.get(key);
            const metadata = await observer.head(key);
            return { upload, object, metadata };
          });
        return {
          user,
          db,
          sectionJwId: section.jwId,
          sectionId: section.id,
          quotaLabel: "",
          objects,
          writes: [],
          readUpload,
          prepareUpload: () =>
            run(async () => {
              const key = `uploads/${user.id}/${crypto.randomUUID()}`;
              await withUploadObserver(isolatedWorker.origin, (observer) =>
                observer.put(key, "Learning material", {
                  httpMetadata: { contentType: "text/plain" },
                }),
              );
              const upload = await db.upload.create({
                data: {
                  userId: user.id,
                  key,
                  filename: "lecture-notes.txt",
                  contentType: "text/plain",
                  size: Buffer.byteLength("Learning material"),
                },
              });
              objects.set(upload.id, await readUpload(upload.id, key));
              return upload.id;
            }),
          upload: (filename = "lecture-notes.txt") =>
            run(async () => {
              const result = await createUploadedFileViaApi(user.request, {
                filename,
                contents: "Learning material",
              });
              const state = await readUpload(result.uploadId, result.key);
              objects.set(result.uploadId, state);
              const stored = state.object;
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
                  expect(owned.writes).toEqual([]);
                }),
              async (response, request) => {
                await response.body();
                const id = new URL(request.url()).pathname.match(
                  /^\/api\/workspace\/uploads\/([^/]+)$/,
                )?.[1];
                if (id && ["PATCH", "DELETE"].includes(request.method())) {
                  const write = owned.writes.shift();
                  expect(write).toMatchObject({
                    id,
                    method: request.method(),
                    status: response.status(),
                  });
                  const before = owned.objects.get(id);
                  if (!write || !before?.upload)
                    throw new Error("Upload write has no scenario-owned state");
                  const after = await owned.readUpload(id, before.upload.key);
                  expectUploadWriteState(before, after, write);
                  owned.objects.set(id, after);
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

test("upload.web-list", { tag: "@Upload/Web" }, async ({
  page,
  request,
  owned,
  uploadRun,
}) => {
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

    const filters = new URLSearchParams({
      filename: "material",
      size: "1024",
      sizeOp: "between",
      sizeMax: "1024",
      createdAt: "2026-01-01",
    });
    const apply = page.getByRole("button", {
      name: "Apply filters",
      exact: true,
    });
    await expect(apply).toHaveCount(1);
    const filterForm = page.locator("#uploads-filters");
    await filterForm
      .getByRole("searchbox", { name: "Search filenames", exact: true })
      .fill("material");
    await expect(
      filterForm.getByRole("button", { name: "Apply filters", exact: true }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "More conditions", exact: true })
      .click();
    const more = page.getByRole("dialog", {
      name: "More conditions",
      exact: true,
    });
    await expect(more.getByText("In bytes", { exact: true })).toBeVisible();
    await expect(apply).toHaveCount(1);
    await expect(apply).toHaveAttribute("form", "uploads-filters");
    await more
      .getByRole("combobox", { name: "Size · Comparison", exact: true })
      .selectOption("between");
    await more
      .getByRole("spinbutton", { name: "Size", exact: true })
      .fill("1024");
    await more
      .getByRole("spinbutton", { name: "Upper bound", exact: true })
      .fill("1024");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Uploaded", exact: true }).click();
    await page
      .locator('[data-filter-field="createdAt"]:visible')
      .getByLabel("Uploaded", { exact: true })
      .fill("2026-01-01");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/workspace\/uploads$/);
    await apply.click();
    await expect(page).toHaveURL((url) =>
      [...filters].every(([key, value]) => url.searchParams.get(key) === value),
    );
    await expect(visibleRows(page)).toHaveCount(20);
    const nextPage = page.getByRole("link", { name: "Load more", exact: true });
    const nextHref = await nextPage.getAttribute("href");
    const nextParams = new URL(nextHref ?? "", page.url()).searchParams;
    for (const [key, value] of filters) expect(nextParams.get(key)).toBe(value);
    await filterForm
      .getByRole("searchbox", { name: "Search filenames", exact: true })
      .fill("material-20");
    await page.locator('[data-slot="endless-scroll"]').scrollIntoViewIfNeeded();
    await expect(page).toHaveURL((url) => !url.searchParams.has("page"));
    await expect(visibleRows(page)).toHaveCount(21);
    await expect(
      filterForm.getByRole("searchbox", {
        name: "Search filenames",
        exact: true,
      }),
    ).toHaveValue("material-20");
    await expect(visibleRows(page).last()).toContainText("material-00.txt");
    for (const [key, value] of filters)
      expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    await page.reload();
    await expect(visibleRows(page)).toHaveCount(20);
    await expect(visibleRows(page).first()).toContainText("material-20.txt");
    for (const [key, value] of filters)
      expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    await page.locator('[data-slot="endless-scroll"]').scrollIntoViewIfNeeded();
    await expect(visibleRows(page)).toHaveCount(21);
    await expect(visibleRows(page).last()).toContainText("material-00.txt");
    await expect(
      page.getByText("other-private-file.txt", { exact: true }),
    ).toHaveCount(0);
    await page.goto(`/workspace/uploads?${filters}&page=900`);
    await expect(page).toHaveURL(/page=2$/);
    for (const [key, value] of filters)
      expect(new URL(page.url()).searchParams.get(key)).toBe(value);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoAndWaitForReady(page, "/workspace/overview");
    const avatar = page.locator("#app-user-menu").getByRole("button");
    await expect(avatar).toHaveCount(1);
    await expect(avatar).toBeVisible();
    await avatar.click();
    await page
      .getByRole("menu")
      .getByRole("menuitem", { name: "My Uploads", exact: true })
      .click();
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
      page.getByRole("button", {
        name: "重命名 material-20.txt",
        exact: true,
      }),
    ).toBeVisible();
  });
});

test("upload.web-rename", { tag: "@Upload/Web" }, async ({
  page,
  owned,
  uploadRun,
}) => {
  await uploadRun(async () => {
    const id = await owned.prepareUpload();
    owned.writes.push(
      { id, method: "PATCH", status: 403 },
      { id, method: "PATCH", status: 200, filename: "renamed-notes.txt" },
    );
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

test("upload.web-delete-feedback", { tag: "@Upload/Web" }, async ({
  page,
  owned,
  uploadRun,
}) => {
  await uploadRun(async () => {
    const id = await owned.prepareUpload();
    owned.writes.push(
      { id, method: "DELETE", status: 403 },
      { id, method: "DELETE", status: 200 },
    );
    await gotoAndWaitForReady(page, "/workspace/uploads");
    await page
      .getByRole("button", { name: "Delete lecture-notes.txt", exact: true })
      .click();
    const dialog = page.getByRole("alertdialog", {
      name: "Delete",
      exact: true,
    });
    const confirm = dialog.getByRole("button", {
      name: "Delete",
      exact: true,
    });
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

    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(
      page
        .getByText("No uploads yet", { exact: true })
        .filter({ visible: true }),
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

test("cases.content-security.deletion-confirmation", {
  tag: "@Upload/Web",
}, async ({ page, owned, uploadRun }) => {
  await uploadRun(async () => {
    const id = await owned.upload();
    owned.writes.push({ id, method: "DELETE", status: 200 });
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

test("upload.comment-attachments-only", { tag: "@Upload/Web" }, async ({
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
          name: /^(?:Upload|Share)(?:\s|$)|^Create public link\b/i,
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
