import { expect, type Locator, type Route } from "@playwright/test";
import en from "../../../../../messages/en-us.json" with { type: "json" };
import zh from "../../../../../messages/zh-cn.json" with { type: "json" };
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const rootId = "demo-comment-course-01";
const lastReply = "demo-comment-course-reply-11";

async function expectReadableText(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const clipped = await locator.evaluate((element) => {
    const failures: string[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent?.trim() || text.parentElement?.closest(".katex"))
        continue;
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        if (
          rect.left < 0 ||
          rect.top < 0 ||
          rect.right > innerWidth ||
          rect.bottom > innerHeight
        )
          failures.push(`viewport: ${text.textContent}`);
        for (
          let ancestor = text.parentElement;
          ancestor && ancestor !== document.documentElement;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          const box = ancestor.getBoundingClientRect();
          if (
            /^(hidden|clip|auto|scroll)$/.test(style.overflowX) &&
            (rect.left < box.left + Number.parseFloat(style.borderLeftWidth) ||
              rect.right >
                box.right - Number.parseFloat(style.borderRightWidth))
          )
            failures.push(
              `horizontal ${ancestor.tagName}: ${text.textContent}`,
            );
          if (
            /^(hidden|clip|auto|scroll)$/.test(style.overflowY) &&
            (rect.top < box.top + Number.parseFloat(style.borderTopWidth) ||
              rect.bottom >
                box.bottom - Number.parseFloat(style.borderBottomWidth))
          )
            failures.push(`vertical ${ancestor.tagName}: ${text.textContent}`);
        }
      }
    }
    return failures;
  });
  expect(clipped).toEqual([]);
}

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [1280, 390])
    test(
      `demo.community: complete read-only browsing ${locale} ${width}`,
      { tag: "@Account/Web" },
      async ({ page, isolatedWorker, run }, info) => {
        await withBrowserWorkflow(page, async (workflow) =>
          workflow.run(() =>
            run(() =>
              workflow.body(async () => {
                const copy = (locale === "en-us" ? en : zh).comments;
                const detail = (locale === "en-us" ? en : zh).sectionDetail;
                const signed = await createSignedDemoCookie({
                  issuedAt: Math.floor(Date.now() / 1000),
                });
                await page.setViewportSize({ width, height: 844 });
                await page.context().addCookies([
                  { ...signed, url: isolatedWorker.origin },
                  {
                    name: "NEXT_LOCALE",
                    value: locale,
                    url: isolatedWorker.origin,
                  },
                ]);
                await page
                  .context()
                  .grantPermissions(["clipboard-read", "clipboard-write"]);
                const writes: string[] = [];
                const observe = (request: {
                  method(): string;
                  url(): string;
                }) => {
                  if (!["GET", "HEAD"].includes(request.method()))
                    writes.push(
                      `${request.method()} ${new URL(request.url()).pathname}`,
                    );
                };
                page.on("request", observe);
                try {
                  await gotoAndWaitForReady(
                    page,
                    "/catalog/courses/920001#comments",
                  );
                  const comments = page.locator("#comments");
                  const roots = comments.locator(
                    'article[id^="comment-demo-comment-course-"]:not([id*="-reply-"])',
                  );
                  await expect(roots).toHaveCount(20);
                  const main = page.locator(`#comment-${rootId}`);
                  await expect(
                    main.getByRole("heading", { level: 3 }),
                  ).toHaveText(
                    locale === "en-us" ? "Sample student Xia" : "样例同学·小夏",
                  );
                  await expect(
                    main.locator('img[src="/images/icon.png"]'),
                  ).toBeVisible();
                  await expect(main.locator(".katex")).toHaveCount(2);
                  await expect(main.getByRole("table")).toBeVisible();
                  await expect(
                    main.getByRole("button", { name: "👍 3", exact: true }),
                  ).toBeDisabled();
                  await expect(
                    main.getByRole("button", {
                      name: copy.reactionMenu,
                      exact: true,
                    }),
                  ).toBeDisabled();
                  for (const name of [
                    copy.replyAction,
                    copy.editAction,
                    copy.deleteAction,
                  ])
                    await expect(
                      main.getByRole("button", { name, exact: true }),
                    ).toHaveCount(0);
                  await expect(comments.getByRole("textbox")).toHaveCount(0);
                  await expect(
                    comments.getByRole("button", {
                      name: locale === "en-us" ? "Post comment" : "发布评论",
                      exact: true,
                    }),
                  ).toBeDisabled();
                  await expect(comments).toContainText(
                    locale === "en-us"
                      ? "Changes and external actions are disabled."
                      : "无法修改数据或执行外部操作",
                  );
                  await expect(
                    page.locator('a[href^="/community/users/"]'),
                  ).toHaveCount(0);
                  await expectReadableText(
                    main.getByRole("heading", { level: 3 }),
                  );
                  await expectReadableText(
                    main.locator(".markdown-preview p").first(),
                  );
                  await expectRenderedUiQuality(page);
                  await expectNoPageHorizontalOverflow(page);
                  await comments
                    .getByRole("heading", {
                      level: 2,
                      name: copy.title,
                      exact: true,
                    })
                    .scrollIntoViewIfNeeded();
                  await page.screenshot({
                    path: info.outputPath(
                      `after-community-${locale}-${width}.png`,
                    ),
                    fullPage: false,
                  });

                  await expect(
                    page.locator(`#comment-${lastReply}`),
                  ).toHaveCount(0);
                  await comments
                    .getByRole("button", {
                      name: `${copy.tabCourse}: ${copy.loadMoreComments}`,
                      exact: true,
                    })
                    .click();
                  await expect(roots).toHaveCount(21);
                  await expect(
                    comments.getByTestId("comment-target-load-controls"),
                  ).toHaveCount(0);
                  await comments
                    .getByRole("button", {
                      name: copy.loadMoreReplies,
                      exact: true,
                    })
                    .click();
                  await expect(
                    page.locator(`#comment-${lastReply}`),
                  ).toBeVisible();
                  await expect(
                    comments.getByRole("button", {
                      name: copy.loadMoreReplies,
                      exact: true,
                    }),
                  ).toHaveCount(0);
                  const ids = await comments
                    .locator('article[id^="comment-demo-comment-course-"]')
                    .evaluateAll((nodes) => nodes.map(({ id }) => id));
                  expect(ids).toHaveLength(32);
                  expect(new Set(ids).size).toBe(32);
                  await main
                    .getByRole("button", {
                      name: copy.moreActions,
                      exact: true,
                    })
                    .click();
                  await expect(
                    page.getByRole("menuitem", {
                      name: copy.deleteAction,
                      exact: true,
                    }),
                  ).toHaveCount(0);
                  await page
                    .getByRole("menuitem", {
                      name: copy.copyLinkAction,
                      exact: true,
                    })
                    .click();
                  await expect
                    .poll(() =>
                      page.evaluate(() => navigator.clipboard.readText()),
                    )
                    .toBe(
                      `${isolatedWorker.origin}/catalog/courses/920001#comment-${rootId}`,
                    );
                  for (const id of ["demo-comment-course-21", lastReply]) {
                    await gotoAndWaitForReady(
                      page,
                      `/community/comments/${id}`,
                    );
                    await expect(page).toHaveURL(
                      `${isolatedWorker.origin}/catalog/courses/920001#comment-${id}`,
                    );
                    await expect(page.locator(`#comment-${id}`)).toBeVisible();
                    await expectReadableText(
                      page
                        .locator(`#comment-${id} .markdown-preview p`)
                        .first(),
                    );
                  }
                  await gotoAndWaitForReady(
                    page,
                    "/catalog/sections/910001#comments",
                  );
                  await expect(
                    page.locator("#comment-demo-comment-section-101"),
                  ).toBeVisible();
                  await page
                    .getByTestId("comment-target-load-controls")
                    .getByRole("button", {
                      name: `${detail.courseComments}: ${copy.loadTarget}`,
                      exact: true,
                    })
                    .click();
                  await expect(
                    page.locator(`#comment-${rootId}`),
                  ).toContainText(
                    locale === "en-us"
                      ? "How can we check a basis?"
                      : "怎样检查一组基？",
                  );
                  await page
                    .getByTestId("comment-target-load-controls")
                    .getByRole("button", {
                      name: `${copy.tabSectionTeacher}: ${copy.loadTarget}`,
                      exact: true,
                    })
                    .click();
                  await expect(
                    page.locator(
                      "#comment-demo-comment-section-teacher-101-401",
                    ),
                  ).toBeVisible();
                  const courseApi = await page.request.get(
                    "/api/community/comments?targetType=course&courseJwId=920001",
                  );
                  expect(courseApi.status()).toBe(200);
                  expect((await courseApi.json()).pagination.total).toBe(21);
                  await gotoAndWaitForReady(
                    page,
                    "/catalog/teachers/401#comments",
                  );
                  await expect(
                    page.locator("#comment-demo-comment-teacher-401"),
                  ).toContainText(
                    locale === "en-us" ? "specific question" : "具体问题",
                  );
                  await gotoAndWaitForReady(
                    page,
                    "/community/comments/demo-comment-homework-vectors",
                  );
                  const dialog = page.getByRole("dialog");
                  await expect(
                    dialog.locator("#comment-demo-comment-homework-vectors"),
                  ).toContainText(
                    locale === "en-us" ? "closure argument" : "验证封闭性",
                  );
                  await expect(dialog.getByRole("textbox")).toHaveCount(0);
                  await expectNoPageHorizontalOverflow(page);
                  expect(writes).toEqual([]);
                  await page.keyboard.press("Escape");
                } finally {
                  page.off("request", observe);
                }
              }),
            ),
          ),
        );
      },
    );

test("demo.community: late private-owner responses and history cannot restore another identity", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, async (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          const db = isolatedWorker.database.owner;
          const privateName = "Private discussion owner";
          const privateBody =
            "This real owner's held discussion must never appear in demo";
          await db.user.update({
            where: { id: actor.id },
            data: { name: privateName },
          });
          const course = await db.course.create({
            data: {
              id: 201,
              jwId: 920001,
              code: "REAL-IDENTITY",
              nameCn: "Real identity course",
            },
          });
          const privateComment = await db.comment.create({
            data: {
              courseId: course.id,
              userId: actor.id,
              body: privateBody,
              visibility: "logged_in_only",
            },
          });
          await page.context().addCookies([
            actor.cookie,
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
          const release = createDeferred();
          const operations: Promise<void>[] = [];
          const failures: unknown[] = [];
          let captured = 0;
          let hold = true;
          const pattern = /\/api\/community\/comments\?/;
          const handler = (route: Route) => {
            const operation = (async () => {
              if (!hold) {
                await route.continue();
                return;
              }
              const response = await route.fetch();
              expect(response.status()).toBe(200);
              const body = await response.json();
              expect(body.pagination.total).toBe(1);
              expect(body.data).toMatchObject([
                {
                  id: privateComment.id,
                  body: privateBody,
                  author: { id: actor.id },
                },
              ]);
              captured++;
              await release.promise;
              await route.fulfill({ response });
            })();
            operations.push(
              operation.catch((error) => {
                failures.push(error);
              }),
            );
            return operation;
          };
          const close = () => release.resolve();
          page.on("close", close);
          await page.route(pattern, handler);
          try {
            // The real comment response stays held until after identity changes.
            await page.goto("/catalog/courses/920001#comments", {
              waitUntil: "domcontentloaded",
            });
            await expect(page.locator("html")).toHaveAttribute(
              "data-life-ustc-hydrated",
              "true",
            );
            await expect(page.getByRole("heading", { level: 1 })).toContainText(
              "Real identity course",
            );
            await expect.poll(() => captured).toBe(1);
            await expect(
              page.locator(`#comment-${privateComment.id}`),
            ).toHaveCount(0);
            const accountMenu = page.locator("#app-user-menu");
            await expect(accountMenu).toContainText(privateName);
            const ownerBootstrap = await (
              await page.request.get("/_internal/shell-bootstrap")
            ).json();
            expect(ownerBootstrap.viewer.id).toBe(actor.id);
            await accountMenu.getByRole("button").click();
            await page.getByRole("menuitem", { name: /Sign Out/i }).click();
            await expect(page).toHaveURL(/\/$/);
            hold = false;
            await gotoAndWaitForReady(page, "/account/sign-in");
            await page
              .getByRole("button", { name: "Enter demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/workspace\/todos$/);
            await gotoAndWaitForReady(page, "/catalog/courses/920001#comments");
            await expect(page.locator(`#comment-${rootId}`)).toBeVisible();
            const bootstrap = await (
              await page.request.get("/_internal/shell-bootstrap")
            ).json();
            expect(bootstrap.viewer).toBeNull();
            expect(bootstrap.demo.fixtureVersion).toBe("workspace-v1");
            release.resolve();
            await Promise.all(operations);
            expect(failures).toEqual([]);
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await expect(page.locator("#app-user-menu")).toHaveCount(0);
            for (const value of [privateName, privateBody, actor.id])
              expect(
                await page.locator("#main-content").textContent(),
              ).not.toContain(value);
            expect(captured).toBe(1);
            await page
              .getByRole("button", { name: "Exit demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/account\/sign-in$/);
            await page.goBack({ waitUntil: "domcontentloaded" });
            await expect(page.getByTestId("demo-notice")).toHaveCount(0);
            await expect(page.locator(`#comment-${rootId}`)).toHaveCount(0);
            await expect(
              page.locator(`#comment-${privateComment.id}`),
            ).toHaveCount(0);
            expect(
              await page.locator("#main-content").textContent(),
            ).not.toContain(privateBody);
          } finally {
            release.resolve();
            await Promise.all(operations);
            if (!page.isClosed()) await page.unroute(pattern, handler);
            page.off("close", close);
          }
        }),
      ),
    ),
  );
});
