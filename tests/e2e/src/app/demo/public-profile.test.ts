import { expect, type Page, type Request, type Route } from "@playwright/test";
import { unflatten } from "devalue";
import { isRecord } from "../../../../../src/lib/is-record";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
type Locale = "en-us" | "zh-cn";
const cells = (page: Page) => page.locator("[data-profile-contribution-cell]");
const detail = (page: Page) =>
  page.locator("[data-profile-contribution-detail]");
async function demo(
  page: Page,
  origin: string,
  locale: Locale,
  issuedAt = Math.floor(Date.now() / 1000),
) {
  await page.context().clearCookies();
  await page.context().addCookies([
    { ...(await createSignedDemoCookie({ issuedAt })), url: origin },
    { name: "NEXT_LOCALE", value: locale, url: origin },
  ]);
}
async function expectGrid(page: Page) {
  const grid = page.locator("[data-profile-contribution-grid]");
  await expect(grid).toHaveAttribute("aria-colcount", "53");
  await expect(grid).toHaveAttribute("aria-rowcount", "7");
  await expect(grid.getByRole("row")).toHaveCount(7);
  await expect(cells(page)).toHaveCount(53 * 7);
  await expect(cells(page).first()).toHaveAttribute("data-date", "2025-09-21");
  await expect(cells(page).last()).toHaveAttribute("data-date", "2026-09-26");
}
for (const { locale, width } of [
  { locale: "en-us", width: 1280 },
  { locale: "zh-cn", width: 390 },
] as const) {
  test(`demo public profile: existing author, accessible Sunday heatmap ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width, height: 844 });
            await demo(page, isolatedWorker.origin, locale);
            await gotoAndWaitForReady(page, "/community/users/sample-xia");
            const english = locale === "en-us";
            const name = english ? "Sample student Xia" : "样例同学·小夏";
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              name,
            );
            await expect(page.getByRole("heading", { level: 2 })).toHaveText(
              english ? "Last year contributions (35)" : "最近一年贡献（35）",
            );
            await expect(page.getByTestId("demo-notice")).toContainText(
              english
                ? "Changes and external actions are disabled."
                : "无法修改数据或执行外部操作。",
            );
            await expect(page.getByTestId("demo-notice")).toContainText(
              english ? "Sep 24, 2026" : "2026年9月24日",
            );
            await expect(
              page.getByRole("img", { name, exact: true }),
            ).toHaveAttribute("src", "/images/icon.png");
            // These are the existing contribution footer badges, not a test-only projection.
            for (const text of english
              ? ["35 Comments", "0 Uploads", "0 Created homework"]
              : ["35 评论", "0 上传", "0 创建作业"])
              await expect(
                page.locator('[data-slot="badge"]').filter({ hasText: text }),
              ).toHaveCount(1);
            await expectGrid(page);
            await expect(
              page.locator('[data-profile-contribution-grid] [tabindex="0"]'),
            ).toHaveCount(1);
            await cells(page).first().focus();
            await page.keyboard.press("End");
            const sunday = page.locator(
              '[data-profile-contribution-cell][data-date="2026-09-20"]',
            );
            await expect(sunday).toBeFocused();
            await expect(sunday).toHaveAttribute("data-count", "1");
            await expect(sunday).toHaveAttribute("aria-rowindex", "1");
            await expect(sunday).toHaveAttribute("aria-colindex", "53");
            const sundayLabel = english
              ? "1 activity on Sep 20, 2026"
              : "2026年9月20日：1 条记录";
            await expect(sunday).toHaveAttribute("aria-label", sundayLabel);
            await expect(sunday).toHaveAttribute("aria-selected", "true");
            await expect(detail(page)).toHaveAttribute("aria-live", "polite");
            await expect(detail(page)).toHaveText(sundayLabel);
            for (let index = 0; index < 3; index++)
              await page.keyboard.press("ArrowDown");
            const wednesday = page.locator(
              '[data-profile-contribution-cell][data-date="2026-09-23"]',
            );
            await expect(wednesday).toBeFocused();
            await expect(wednesday).toHaveAttribute("data-count", "19");
            await expect(wednesday).toHaveAttribute("aria-selected", "true");
            await expect(sunday).toHaveAttribute("aria-selected", "false");
            const wednesdayLabel = english
              ? "19 activities on Sep 23, 2026"
              : "2026年9月23日：19 条记录";
            await expect(wednesday).toHaveAttribute(
              "aria-label",
              wednesdayLabel,
            );
            await expect(detail(page)).toHaveText(wednesdayLabel);
            await expect(page.locator("footer")).toBeVisible();
            await expect(page.locator('footer a[href="/terms"]')).toHaveCount(
              1,
            );
            await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(
              1,
            );
            await expectRenderedUiQuality(page);
            await expectNoPageHorizontalOverflow(page);
            await page.screenshot({
              path: `/tmp/life1555-after-public-profile-${locale}-${width}.png`,
              fullPage: true,
            });
          }),
        ),
      ),
    );
  });
}

test("demo public profile: real same-URL ordinary response cannot restore retired author or heatmap selection", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          const privateName = `Ordinary public profile ${actor.id}`;
          await isolatedWorker.database.owner.user.update({
            where: { id: actor.id },
            data: { username: "sample-qiu", name: privateName },
          });
          await page.setViewportSize({ width: 1280, height: 844 });
          await page.context().addCookies([
            actor.cookie,
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
          const bootstrap = page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                "/_internal/shell-bootstrap" && response.ok(),
          );
          await gotoAndWaitForReady(page, "/community/users/sample-qiu");
          expect((await (await bootstrap).json()).viewer.id).toBe(actor.id);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            privateName,
          );
          await cells(page).last().focus();
          await expect(detail(page)).not.toHaveText("");
          const previousSelection = await detail(page).textContent();
          expect(previousSelection).not.toBe("");
          const originalDocument = await page.evaluateHandle(() => document);
          const originalMain = await page.locator("main").elementHandle();
          expect(originalMain).not.toBeNull();
          await page.evaluate(() =>
            Object.assign(window, { publicProfileDocument: true }),
          );
          const captured = createDeferred(),
            release = createDeferred();
          void captured.promise.catch(() => undefined);
          const operations: Promise<void>[] = [],
            errors: unknown[] = [];
          let held: Request | undefined,
            hold = true,
            terminal: "finished" | "failed" | undefined;
          const finished = (request: Request) => {
            if (request === held) terminal = "finished";
          };
          const failed = (request: Request) => {
            if (request === held) terminal = "failed";
          };
          const closing = () => {
            release.resolve();
            captured.reject(
              new Error("Profile closed before ordinary data capture"),
            );
          };
          const pattern = "**/community/users/sample-qiu/__data.json*";
          const handler = (route: Route) => {
            const operation = (async () => {
              if (!hold) {
                await route.continue();
                return;
              }
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const body: unknown = await response.json();
              if (!isRecord(body) || !Array.isArray(body.nodes))
                throw new Error(
                  "Expected native SvelteKit ordinary profile response",
                );
              const decoded: Record<string, unknown>[] = [];
              for (const node of body.nodes) {
                if (!isRecord(node) || !Array.isArray(node.data)) continue;
                const data: unknown = unflatten(node.data);
                if (!isRecord(data))
                  throw new Error("Expected decoded profile node");
                decoded.push(data);
              }
              const data: Record<string, unknown> = Object.assign(
                {},
                ...decoded,
              );
              expect(data).toMatchObject({
                pageDemo: null,
                pageLocale: "en-us",
                user: {
                  id: actor.id,
                  name: privateName,
                  username: "sample-qiu",
                },
              });
              if (held) throw new Error("Duplicate ordinary profile capture");
              held = route.request();
              captured.resolve();
              await release.promise;
              await route.fulfill({ response }).catch((error: unknown) => {
                if (route.request().failure()?.errorText !== "net::ERR_ABORTED")
                  throw error;
              });
            })();
            operations.push(operation);
            void operation.catch((error: unknown) => {
              errors.push(error);
              captured.reject(error);
            });
            return operation;
          };
          try {
            page.on("close", closing);
            page.on("requestfinished", finished);
            page.on("requestfailed", failed);
            await page.route(pattern, handler);
            await page.locator("#app-user-menu").click();
            const first = page.getByRole("menuitem", {
              name: "Personal page",
              exact: true,
            });
            await expect(first).toHaveAttribute(
              "href",
              "/community/users/sample-qiu",
            );
            const navigation = first.click();
            operations.push(navigation);
            void navigation.catch((error: unknown) => {
              errors.push(error);
              captured.reject(error);
            });
            await captured.promise;
            await demo(page, isolatedWorker.origin, "en-us");
            hold = false;
            // The existing ordinary shell still owns this real same-URL menu anchor.
            await page.locator("#app-user-menu").click();
            const second = page.getByRole("menuitem", {
              name: "Personal page",
              exact: true,
            });
            await expect(second).toHaveAttribute(
              "href",
              "/community/users/sample-qiu",
            );
            await second.click();
            await waitForUiSettled(page);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Sample student Qiu",
            );
            await expect(page.getByRole("heading", { level: 2 })).toHaveText(
              "Last year contributions (34)",
            );
            await expectGrid(page);
            await expect(detail(page)).toHaveText("");
            await cells(page).first().focus();
            await expect(detail(page)).not.toHaveText("");
            const selectedDemoLabel = await detail(page).textContent();
            expect(selectedDemoLabel).not.toBe(previousSelection);
            release.resolve();
            await Promise.all(operations);
            await expect.poll(() => terminal).toMatch(/^(finished|failed)$/);
            expect(errors).toEqual([]);
            expect(
              await originalDocument.evaluate((value) => value === document),
            ).toBe(true);
            expect(
              await originalMain?.evaluate(
                (value) => value === document.querySelector("main"),
              ),
            ).toBe(true);
            expect(
              await page.evaluate(() => "publicProfileDocument" in window),
            ).toBe(true);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Sample student Qiu",
            );
            await expect(
              page.getByText(privateName, { exact: true }),
            ).toHaveCount(0);
            await expect(detail(page)).toHaveText(selectedDemoLabel ?? "");
            await expect(page.locator("#app-user-menu")).toHaveCount(0);
            expect(
              await isolatedWorker.database.owner.user.findUniqueOrThrow({
                where: { id: actor.id },
                select: { name: true, username: true },
              }),
            ).toEqual({ name: privateName, username: "sample-qiu" });
          } catch (error) {
            errors.push(error);
          } finally {
            release.resolve();
            await Promise.allSettled(operations);
            if (!page.isClosed()) await page.unroute(pattern, handler);
            page.off("close", closing);
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
            await originalDocument.dispose();
            await originalMain?.dispose();
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Retired ordinary public profile response failed",
            );
        }),
      ),
    ),
  );
});

test("demo public profile: real language reload, expiry, denied API and Exit/back retire author", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          // Real server-signed expiry with roughly fifteen seconds left, not a mocked browser clock.
          await demo(
            page,
            isolatedWorker.origin,
            "en-us",
            Math.floor(Date.now() / 1000) - 885,
          );
          await gotoAndWaitForReady(page, "/community/users/sample-xia");
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "Sample student Xia",
          );
          await cells(page).first().focus();
          await expect(detail(page)).not.toHaveText("");
          await page.evaluate(() =>
            Object.assign(window, { publicProfileLocaleDocument: true }),
          );
          await page
            .getByRole("button", { name: "Language selector", exact: true })
            .click();
          const [preference] = await Promise.all([
            page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname ===
                  "/api/account/preferences" &&
                response.request().method() === "POST",
            ),
            page
              .getByRole("menuitemradio", { name: "中文", exact: true })
              .click(),
          ]);
          expect(preference.status()).toBe(200);
          expect(preference.request().postDataJSON()).toEqual({
            locale: "zh-cn",
          });
          await expect(page.locator("html")).toHaveAttribute("lang", "zh-cn");
          await waitForUiSettled(page);
          expect(
            await page.evaluate(() => "publicProfileLocaleDocument" in window),
          ).toBe(false);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "样例同学·小夏",
          );
          await expect(detail(page)).toHaveText("");
          await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0, {
            timeout: 20_000,
          });
          await expect(cells(page)).toHaveCount(0);
          await expect(detail(page)).toHaveCount(0);
          const denied = await page.request.get(
            "/api/community/users/sample-xia",
          );
          expect(denied.status()).toBe(401);
          expect(await denied.json()).toEqual({
            error: "DEMO_SESSION_INVALID",
          });
          // Expiry removes the profile and its DemoNotice form. Exercise the
          // separate native Exit/back boundary from a fresh real Demo visit.
          await demo(page, isolatedWorker.origin, "zh-cn");
          await gotoAndWaitForReady(page, "/community/users/sample-xia");
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            "样例同学·小夏",
          );
          await page
            .getByRole("button", { name: "退出演示", exact: true })
            .click();
          await expect(page).toHaveURL(/\/account\/sign-in$/);
          await page.goBack();
          await waitForUiSettled(page);
          await expect(
            page.getByRole("heading", {
              name: /样例同学·小夏|Sample student Xia/,
              exact: true,
            }),
          ).toHaveCount(0);
          await expect(cells(page)).toHaveCount(0);
          await expect(detail(page)).toHaveCount(0);
        }),
      ),
    ),
  );
});
