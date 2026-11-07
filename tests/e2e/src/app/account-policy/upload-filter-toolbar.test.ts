import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/personal-preferences-fixture";
import { absoluteTestUrl } from "../../../utils/request-url";

const evidence = process.env.UPLOAD_FILTER_EVIDENCE_DIR;

test("upload filter toolbar matched evidence", { tag: "@Upload/Web" }, async ({
  page,
  baseURL,
  account,
  isolatedWorker,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
    await isolatedWorker.database.owner.upload.createMany({
      data: [
        {
          userId: account.id,
          key: `uploads/${account.id}/lecture`,
          filename: "lecture-notes.txt",
          size: 32,
          createdAt: new Date("2026-01-03T00:00:00Z"),
        },
        {
          userId: account.id,
          key: `uploads/${account.id}/course`,
          filename: "course-material.pdf",
          size: 128,
          createdAt: new Date("2026-01-02T00:00:00Z"),
        },
        {
          userId: account.id,
          key: `uploads/${account.id}/empty`,
          filename: "empty-note.txt",
          size: 0,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });
    for (const locale of ["zh-cn", "en-us"])
      for (const width of [390, 1280]) {
        await page.context().addCookies([
          {
            name: "NEXT_LOCALE",
            value: locale,
            url: absoluteTestUrl("/", baseURL),
          },
        ]);
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(page, "/workspace/uploads");
        await expect(
          page
            .getByText("lecture-notes.txt", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        if (evidence)
          await page.screenshot({
            path: `${evidence}/uploads-${locale}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
  });
});
for (const width of [390, 1280])
  test(`upload Apply preserves newer filename draft ${width}`, {
    tag: "@Upload/Web",
  }, async ({ page, account, isolatedWorker, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await isolatedWorker.database.owner.upload.createMany({
        data: ["alpha-old.txt", "alpha-new.txt", "beta.txt"].map(
          (filename, index) => ({
            userId: account.id,
            key: `uploads/${account.id}/${index}`,
            filename,
            size: 32,
          }),
        ),
      });
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/uploads");
      const input = page.locator("#uploads-filename");
      await input.fill("alpha");
      const release = createDeferred<void>();
      let captured = 0;
      preferenceFlow.onClosing(() => release.resolve());
      await preferenceFlow.route(
        page,
        (url) => url.pathname === "/workspace/uploads/__data.json",
        async (route) => {
          if (
            captured ||
            new URL(route.request().url()).searchParams.get("filename") !==
              "alpha"
          ) {
            await route.continue();
            return;
          }
          const response = await route.fetch();
          expect(response.status()).toBe(200);
          captured++;
          await release.promise;
          await route.fulfill({ response });
        },
      );
      try {
        await page
          .getByRole("button", { name: /^(Apply filters|应用筛选)$/ })
          .click();
        await expect.poll(() => captured).toBe(1);
        await input.fill("alpha-new");
        release.resolve();
        await expect(page).toHaveURL(
          (url) => url.searchParams.get("filename") === "alpha",
        );
        await expect(input).toHaveValue("alpha-new");
        await page
          .getByRole("button", { name: /^(Apply filters|应用筛选)$/ })
          .click();
        await expect(page).toHaveURL(
          (url) => url.searchParams.get("filename") === "alpha-new",
        );
        await expect(
          page
            .getByText("alpha-new.txt", { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText("alpha-old.txt", { exact: true }),
        ).toHaveCount(0);
        await page.goBack();
        await expect(input).toHaveValue("alpha");
        await page.goForward();
        await expect(input).toHaveValue("alpha-new");
      } finally {
        release.resolve();
        await preferenceFlow.clearRoutes(page);
      }
    });
  });

for (const width of [390, 1280])
  test(`upload chip removal preserves unrelated drafts ${width}`, {
    tag: "@Upload/Web",
  }, async ({ page, account, isolatedWorker, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await isolatedWorker.database.owner.upload.create({
        data: {
          userId: account.id,
          key: `uploads/${account.id}/chip`,
          filename: "alpha.txt",
          size: 32,
          createdAt: new Date("2026-01-03T00:00:00Z"),
        },
      });
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(
        page,
        "/workspace/uploads?filename=alpha&size=32&sizeOp=between&sizeMax=32&createdAt=2026-01-03",
      );
      const filename = page.locator("#uploads-filename");
      await filename.fill("alpha-new");
      await page.getByRole("button", { name: /^(Uploaded|上传时间)$/ }).click();
      const date = page.locator(
        '[data-filter-field="createdAt"]:visible input',
      );
      await date.fill("2026-01-04");
      await page.keyboard.press("Escape");
      await page
        .locator('[data-slot="active-filters"]')
        .getByRole("link", { name: /Size:|大小：|大小:/ })
        .click();
      await expect(page).toHaveURL(
        (url) =>
          !url.searchParams.has("size") &&
          !url.searchParams.has("sizeOp") &&
          !url.searchParams.has("sizeMax") &&
          url.searchParams.get("filename") === "alpha",
      );
      await page.getByRole("button", { name: /^(Uploaded|上传时间)$/ }).click();
      expect({
        filename: await filename.inputValue(),
        createdAt: await date.inputValue(),
      }).toEqual({ filename: "alpha-new", createdAt: "2026-01-04" });
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: /^(More conditions|更多条件)$/ })
        .click();
      await expect(
        page.locator('[data-filter-field="size"]:visible input'),
      ).toHaveValue("");
      await expect(
        page.locator('[data-filter-field="size"]:visible select'),
      ).toHaveValue("eq");
      await expect(
        page.getByRole("button", { name: /^(Apply filters|应用筛选)$/ }),
      ).toHaveCount(1);
    });
  });

for (const width of [390, 1280])
  test(`upload single Apply keyboard and More draft ${width}`, {
    tag: "@Upload/Web",
  }, async ({ page, baseURL, account, isolatedWorker, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      await isolatedWorker.database.owner.upload.createMany({
        data: [
          { filename: "alpha-new.txt", size: 64 },
          { filename: "alpha-old.txt", size: 32 },
          { filename: "beta.txt", size: 32 },
        ].map((row, index) => ({
          ...row,
          userId: account.id,
          key: `uploads/${account.id}/keyboard-${index}`,
        })),
      });
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: "en-us",
          url: absoluteTestUrl("/", baseURL),
        },
      ]);
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/workspace/uploads");
      const submits = page.locator(
        'button[type="submit"][form="uploads-filters"]',
      );
      await expect(submits).toHaveCount(1);
      await expect(page.locator("form#uploads-filters")).toHaveCount(1);
      await expect(page.locator("form form")).toHaveCount(0);
      const filename = page.locator("#uploads-filename");
      await filename.fill("alpha");
      await filename.press("Enter");
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("filename") === "alpha",
      );
      await page
        .getByRole("button", { name: "More conditions", exact: true })
        .click();
      await expect(submits).toHaveCount(1);
      await expect(submits).toBeVisible();
      const size = page.locator('[data-filter-field="size"]:visible input');
      await size.fill("64");
      await size.press("Enter");
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("size") === "64" &&
          url.searchParams.get("filename") === "alpha",
      );
      await expect(
        page.getByRole("dialog", { name: "More conditions", exact: true }),
      ).toBeHidden();
      await expect(submits).toHaveCount(1);
      await expect(
        page
          .getByText("alpha-new.txt", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(
        page.getByText("alpha-old.txt", { exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "More conditions", exact: true })
        .click();
      await size.fill("32");
      await page.keyboard.press("Escape");
      await page
        .getByRole("button", { name: "More conditions", exact: true })
        .click();
      await expect(size).toHaveValue("32");
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("size") === "64",
      );
      await page
        .getByRole("button", { name: "Apply filters", exact: true })
        .click();
      await expect(page).toHaveURL(
        (url) => url.searchParams.get("size") === "32",
      );
      await expect(
        page
          .getByText("alpha-old.txt", { exact: true })
          .filter({ visible: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "More conditions", exact: true })
        .click();
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      await expect(page).toHaveURL((url) => !url.search);
      await expect(filename).toHaveValue("");
      await page.goBack();
      await expect(filename).toHaveValue("alpha");
      await page.goForward();
      await expect(filename).toHaveValue("");
    });
  });
for (const hasZeroByteFile of [false, true])
  test(`upload no-data versus no-match owner existence ${hasZeroByteFile}`, {
    tag: "@Upload/Web",
  }, async ({ page, baseURL, account, isolatedWorker, preferenceFlow }) => {
    await preferenceFlow.run(async () => {
      const db = isolatedWorker.database.owner;
      const foreign = await isolatedWorker.createActor();
      await db.upload.create({
        data: {
          userId: foreign.id,
          key: `uploads/${foreign.id}/foreign`,
          filename: "foreign-file.txt",
          size: 1024,
        },
      });
      await db.uploadPending.create({
        data: {
          userId: account.id,
          attemptId: "browser-pending",
          key: `uploads/${account.id}/pending`,
          filename: "pending.txt",
          size: 128,
          expiresAt: new Date("2099-01-01T00:00:00Z"),
        },
      });
      if (hasZeroByteFile)
        await db.upload.create({
          data: {
            userId: account.id,
            key: `uploads/${account.id}/zero`,
            filename: "zero-byte.txt",
            size: 0,
          },
        });
      await page.context().addCookies([
        {
          name: "NEXT_LOCALE",
          value: "en-us",
          url: absoluteTestUrl("/", baseURL),
        },
      ]);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await gotoAndWaitForReady(
          page,
          "/workspace/uploads?filename=unmatched",
        );
        await expect(
          page
            .getByText(
              hasZeroByteFile
                ? "No uploads match these conditions"
                : "No uploads yet",
              { exact: true },
            )
            .filter({ visible: true }),
        ).toBeVisible();
        await expect(
          page.getByText(
            hasZeroByteFile
              ? "No uploads yet"
              : "No uploads match these conditions",
            { exact: true },
          ),
        ).toHaveCount(0);
        await expect(
          page.getByText("foreign-file.txt", { exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText("128 B of 100 MB used", { exact: true }),
        ).toBeVisible();
      }
    });
  });
