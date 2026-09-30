import { expect, type Locator } from "@playwright/test";
import { formatBytes } from "@/shared/lib/format-bytes";
import enMessages from "../../../../../messages/en-us.json" with {
  type: "json",
};
import zhMessages from "../../../../../messages/zh-cn.json" with {
  type: "json",
};
import {
  PRIORITY_AVATAR,
  test,
} from "../../../utils/community-priority-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import {
  assertPriorityView,
  type PriorityViewCheck,
} from "../../../utils/property-priority";

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [390, 1280]) {
    test(`ui.model-property-priority-community-views ${locale}/${width}`, async ({
      page,
      baseURL,
      isolatedWorker,
      communityPriority: f,
      communityPriorityDb: communityDb,
      communityPriorityRun,
      communityUploadGate,
    }, testInfo) => {
      test.setTimeout(240_000);
      page.setDefaultTimeout(10_000);
      if (!baseURL) throw new Error("Missing baseURL");
      if (!f.author.name) throw new Error("Missing author name");
      const authorName = f.author.name;
      if (!f.description.lastEditedAt || !f.edit.previousContent)
        throw new Error("Missing description fixture fields");
      const editedAt = f.description.lastEditedAt;
      const previousContent = f.edit.previousContent;
      await communityPriorityRun(async () => {
        await page
          .context()
          .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
        const m = locale === "en-us" ? enMessages : zhMessages;
        const date = (v: Date) =>
          new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Shanghai",
          }).format(v);

        await page.setViewportSize({ width, height: 900 });

        const field = (scope: Locator, text: string, exact = false) => ({
          locator: scope
            .getByText(text, { exact })
            .filter({ visible: true })
            .first(),
          expected: text,
        });
        async function check(input: PriorityViewCheck, label: string) {
          await input.scope.screenshot({
            path: testInfo.outputPath(
              `community-${locale}-${width}-${label}.png`,
            ),
          });
          try {
            await assertPriorityView(input);
          } catch (error) {
            expect
              .soft(error, `${locale}/${width}/${label}: ${String(error)}`)
              .toBeUndefined();
          }
        }
        await page
          .context()
          .addCookies([
            (await isolatedWorker.createSession(f.author.id)).cookie,
          ]);
        await gotoAndWaitForReady(page, `/catalog/courses/${f.course.jwId}`);
        const comment = page.locator(`#comment-${f.comment.id}`);
        await expect(comment).toBeVisible();
        await check(
          {
            scope: comment,
            identity: comment.getByRole("heading", { name: authorName }),
            primary: {
              "comment.author.name": field(comment, authorName),
              "comment.body": field(comment, f.comment.body),
            },
            secondary: {
              "comment.author.image": {
                locator: comment.getByRole("img", { name: authorName }),
                expected: PRIORITY_AVATAR,
                attribute: "src",
              },
              "comment.createdAt": field(comment, date(f.comment.createdAt)),
              "comment.updatedAt": field(comment, date(f.comment.updatedAt)),
              "comment.visibility": field(
                comment,
                m.comments.visibilityLoggedIn,
              ),
              "comment.reactions.count": {
                locator: comment.getByRole("button", { name: /❤️ 1/ }),
                expected: "1",
              },
              "comment.attachments.filename": field(comment, f.upload.filename),
            },
            tertiary: {
              "comment.id": { value: f.comment.id },
              "comment.userId": { value: f.author.id },
              "comment.status": { value: f.comment.status },
            },
          },
          "comment",
        );
        await expect(
          comment.getByText(m.comments.softbannedBadge, { exact: true }),
        ).toHaveCount(0);
        const attachment = comment
          .locator('[data-slot="item"]')
          .filter({ hasText: f.upload.filename });
        await check(
          {
            scope: attachment,
            identity: attachment.locator('[data-slot="item-title"]'),
            primary: {
              "upload.filename": field(attachment, f.upload.filename),
            },
            secondary: {
              "upload.size": field(attachment, `${f.upload.size} B`),
            },
            tertiary: {},
          },
          "download",
        );
        const downloaded = await page.request.get(
          `/api/workspace/uploads/${f.upload.id}/download`,
        );
        expect(await downloaded.text()).toBe("Community priority attachment");

        const introduction = page.locator("#introduction");
        await introduction.scrollIntoViewIfNeeded();
        await expect(
          introduction
            .getByText(f.description.content, { exact: true })
            .filter({ visible: true }),
        ).toBeVisible();
        await check(
          {
            scope: introduction,
            identity: introduction
              .locator('[data-slot="markdown-preview"] p')
              .first(),
            primary: {
              "description.content": field(introduction, f.description.content),
              "history.count": field(
                introduction,
                m.descriptions.historyTitle.replace("{count}", "1"),
              ),
            },
            secondary: {
              "description.lastEditedBy.name": field(introduction, authorName),
              "description.lastEditedAt": field(introduction, date(editedAt)),
            },
            tertiary: {
              "description.id": { value: f.description.id },
              "description.updatedAt": {
                value: f.description.updatedAt.toISOString(),
              },
            },
          },
          "description",
        );
        await introduction
          .getByRole("tab", {
            name: m.descriptions.historyTitle.replace("{count}", "1"),
          })
          .click();
        const history = introduction.getByRole("tabpanel");
        await check(
          {
            scope: history,
            identity: history.getByText(date(f.edit.createdAt), {
              exact: true,
            }),
            primary: {
              "history.createdAt": field(history, date(f.edit.createdAt)),
              "history.previousContent": {
                locator: history.locator(".whitespace-pre-wrap").first(),
                expected: previousContent,
              },
              "history.nextContent": {
                locator: history.locator(".whitespace-pre-wrap").last(),
                expected: f.edit.nextContent,
              },
            },
            secondary: { "history.editor.name": field(history, authorName) },
            tertiary: { "history.id": { value: f.edit.id } },
          },
          "history",
        );

        const revision = history.locator('[data-slot="item"]').filter({
          has: page.getByText(date(f.edit.createdAt), { exact: true }),
        });
        await expect(revision).toHaveCount(1);
        const historyStyles = await revision
          .locator(".whitespace-pre-wrap")
          .evaluateAll(async (bodies) => {
            await document.fonts.ready;
            const typography = (element: Element) => {
              const style = getComputedStyle(element);
              return { size: style.fontSize, lineHeight: style.lineHeight };
            };
            return bodies.map((body) => ({
              base: typography(body),
              segments: [...body.querySelectorAll("span")].map(typography),
            }));
          });
        expect(historyStyles).toHaveLength(2);
        // These are peer versions of one revision, including when desktop puts
        // them in different columns. Diff colors carry meaning and may differ.
        expect(historyStyles[0].base).toEqual(historyStyles[1].base);
        for (const body of historyStyles) {
          expect(body.segments.length).toBeGreaterThan(0);
          for (const segment of body.segments) expect(segment).toEqual(body.base);
        }

        await page
          .context()
          .addCookies([
            (await isolatedWorker.createSession(f.author.id)).cookie,
          ]);
        await gotoAndWaitForReady(page, "/workspace/uploads");
        const main = page.locator("main");
        const row =
          width < 1280
            ? page.getByRole("listitem").filter({ hasText: f.upload.filename })
            : page
                .locator("table:visible tbody tr")
                .filter({ hasText: f.upload.filename });
        const metaResponse = await page.request.get("/api/workspace/uploads");
        const { meta } = await metaResponse.json();
        const usage = m.uploads.usageLabel
          .replace("{used}", formatBytes(f.upload.size))
          .replace("{total}", formatBytes(meta.quotaBytes));
        await check(
          {
            scope: main,
            identity: row.getByText(f.upload.filename, { exact: true }),
            primary: { "upload.filename": field(row, f.upload.filename) },
            secondary: {
              "upload.size": field(row, formatBytes(f.upload.size)),
              "upload.createdAt": field(row, date(f.upload.createdAt)),
              usedBytes: field(main, usage),
              quotaBytes: field(main, usage),
              maxFileSizeBytes: field(
                main,
                m.uploads.fileLimit.replace(
                  "{size}",
                  formatBytes(meta.maxFileSizeBytes),
                ),
              ),
            },
            tertiary: { "upload.id": { value: f.upload.id } },
          },
          "uploads",
        );
        await row
          .getByRole("button", {
            name: `${m.uploads.renameAction} ${f.upload.filename}`,
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        const suspension = await communityDb((db) =>
          db.userSuspension.create({
            data: { userId: f.author.id, reason: "Priority upload feedback" },
          }),
        );
        try {
          const rejected = page.waitForResponse(
            (r) =>
              r.url().endsWith(`/api/workspace/uploads/${f.upload.id}`) &&
              r.request().method() === "PATCH",
          );
          await dialog
            .getByRole("button", {
              name: m.uploads.saveRenameAction,
              exact: true,
            })
            .click();
          expect((await rejected).status()).toBe(403);
          expect(
            await communityDb((db) =>
              db.upload.findUniqueOrThrow({
                where: { id: f.upload.id },
                select: { filename: true, updatedAt: true },
              }),
            ),
          ).toEqual({
            filename: f.upload.filename,
            updatedAt: f.upload.updatedAt,
          });
          await check(
            {
              scope: dialog,
              identity: dialog.getByRole("textbox"),
              primary: {
                "upload.filename": {
                  locator: dialog.getByRole("textbox"),
                  expected: f.upload.filename,
                  input: true,
                },
              },
              secondary: {
                "upload.feedback": field(
                  dialog,
                  m.uploads.toastRenameErrorDescription,
                ),
              },
              tertiary: {},
            },
            "manage",
          );
        } finally {
          await communityDb((db) =>
            db.userSuspension.delete({ where: { id: suspension.id } }),
          );
        }
        await dialog
          .getByRole("button", {
            name: m.uploads.cancelRenameAction,
            exact: true,
          })
          .click();

        await gotoAndWaitForReady(
          page,
          `/community/users/${f.author.username}`,
        );
        const profile = page.locator("main");
        const summary = profile.locator('[data-slot="card"]').first();
        const cell = profile.locator(
          `[data-profile-contribution-cell][data-date="${f.homework.createdAt.toISOString().slice(0, 10)}"]`,
        );
        await cell.focus();
        const day = new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeZone: "Asia/Shanghai",
        }).format(f.homework.createdAt);
        const dayLabel = m.publicProfile.contribution.cellOne
          .replace("{count}", "1")
          .replace("{date}", day);
        const stat = (label: string) => ({
          locator: summary
            .getByText(label, { exact: true })
            .locator("..")
            .locator("span")
            .last(),
          expected: "1",
        });
        await check(
          {
            scope: profile,
            identity: summary.getByRole("heading", { name: authorName }),
            primary: { "user.name": field(summary, authorName) },
            secondary: {
              "user.username": field(summary, `@${f.author.username}`),
              "user.image": {
                locator: summary.getByRole("img", { name: authorName }),
                expected: PRIORITY_AVATAR,
                attribute: "src",
              },
              "user.createdAt": field(
                summary,
                new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeZone: "Asia/Shanghai",
                }).format(f.author.createdAt),
              ),
              "user._count.comments": {
                ...stat(m.publicProfile.stats.comments),
                expected: "0",
              },
              "user._count.uploads": {
                ...stat(m.publicProfile.stats.uploads),
                // The fixture attachment belongs to a restricted comment.
                expected: "0",
              },
              "user._count.homeworksCreated": stat(
                m.publicProfile.stats.homeworks,
              ),
              "weeks.date": field(profile, dayLabel),
              "weeks.count": field(profile, dayLabel),
              totalContributions: field(
                profile,
                m.publicProfile.contribution.title.replace("{count}", "1"),
              ),
            },
            tertiary: { "user.id": { value: f.author.id } },
          },
          "profile",
        );
        await gotoAndWaitForReady(page, `/catalog/courses/${f.course.jwId}`);
        const composer = page.locator("#comments");
        await composer
          .getByRole("button", { name: m.comments.postAction, exact: true })
          .click();
        const { resolve: releasePut } = communityUploadGate;
        const imageName = "community-preview.png";
        let uploadedId: string | undefined;
        try {
          await composer.locator('input[type="file"]').setInputFiles({
            name: imageName,
            mimeType: "image/png",
            buffer: Buffer.from(PRIORITY_AVATAR.split(",")[1], "base64"),
          });
          const editor = composer.getByRole("textbox");
          await check(
            {
              scope: composer,
              identity: editor,
              primary: {
                "file.name": {
                  locator: editor,
                  expected: /community-preview\.png/,
                  input: true,
                },
                "display.uploadState": {
                  locator: editor,
                  expected: new RegExp(
                    m.uploads.uploading.replaceAll(".", "\\."),
                  ),
                  input: true,
                },
              },
              secondary: {},
              tertiary: {},
            },
            "upload-pending",
          );
          const complete = page.waitForResponse(
            (r) =>
              r.url().endsWith("/api/workspace/uploads/complete") &&
              r.request().method() === "POST",
          );
          releasePut();
          const completed = await complete;
          expect(completed.status()).toBe(200);
          uploadedId = (await completed.json()).upload.id;
          await composer
            .getByRole("tab", { name: m.comments.tabPreview, exact: true })
            .click();
          const image = composer.getByRole("img", {
            name: imageName,
            exact: true,
          });
          await expect(image).toBeVisible();
          await expect
            .poll(() =>
              image.evaluate((e) => (e as HTMLImageElement).naturalWidth),
            )
            .toBeGreaterThan(0);
          const filename = composer
            .locator('[data-slot="badge"] span')
            .filter({ hasText: imageName });
          await check(
            {
              scope: composer,
              identity: filename,
              primary: {
                "file.name": { locator: filename, expected: imageName },
              },
              secondary: {
                "file.preview": {
                  locator: image,
                  expected: `/api/workspace/uploads/${uploadedId}/download`,
                  attribute: "src",
                },
              },
              tertiary: {},
            },
            "upload-ready",
          );
        } finally {
          releasePut();
          if (uploadedId)
            expect(
              (
                await page.request.delete(
                  `/api/workspace/uploads/${uploadedId}`,
                )
              ).status(),
            ).toBe(200);
        }
      });
    });
  }
