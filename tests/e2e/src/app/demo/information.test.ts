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
async function demo(page: Page, origin: string, locale: "en-us" | "zh-cn") {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      ...(await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      })),
      url: origin,
    },
    { name: "NEXT_LOCALE", value: locale, url: origin },
  ]);
}
async function noExternalActions(page: Page, origin: string) {
  const document = page.getByTestId("demo-information-document");
  await expect(document).toBeVisible();
  const destinations = await document
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href")),
    );
  for (const href of destinations) {
    expect(href).not.toBeNull();
    expect(new URL(href ?? "", origin).origin).toBe(origin);
  }
  for (const source of await document
    .locator("img[src],video[src],audio[src],iframe[src],source[src]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("src")),
    )) {
    expect(source).not.toBeNull();
    const url = new URL(source ?? "", origin);
    expect(url.origin).toBe(origin);
    expect(url.pathname).toMatch(/^\/images\//);
  }
  for (const button of await document
    .locator('button[aria-describedby="demo-information-reason"]')
    .all()) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveAccessibleDescription(
      /Changes and external actions are disabled\.|无法修改数据或执行外部操作。/,
    );
    await expect(button).not.toHaveAttribute("href");
  }
}

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`demo information reads real documents and local client controls ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const english = locale === "en-us";
            await page.setViewportSize({ width, height: 844 });
            await demo(page, isolatedWorker.origin, locale);
            await gotoAndWaitForReady(page, "/");
            const footer = page.locator("footer nav");
            await expect(footer.locator('a[href="/terms"]')).toHaveCount(1);
            await expect(footer.locator('a[href="/privacy"]')).toHaveCount(1);
            for (const href of await footer
              .locator("a[href]")
              .evaluateAll((anchors) =>
                anchors.map((anchor) => anchor.getAttribute("href")),
              )) {
              expect(href).not.toBeNull();
              expect(new URL(href ?? "", isolatedWorker.origin).origin).toBe(
                isolatedWorker.origin,
              );
            }
            await expect(
              page.locator("[data-overview-sections]"),
            ).toHaveAttribute("aria-busy", "false");
            await page.locator("[data-shell-scroll-container]").focus();
            await page.keyboard.press("Control+End");
            await expect
              .poll(() =>
                page.evaluate(() =>
                  [
                    document.scrollingElement,
                    ...document.querySelectorAll(
                      "[data-shell-scroll-container]",
                    ),
                  ]
                    .filter(
                      (element) =>
                        element !== null &&
                        (element === document.scrollingElement ||
                          ["auto", "scroll", "overlay"].includes(
                            getComputedStyle(element).overflowY,
                          )),
                    )
                    .every(
                      (element) =>
                        element !== null &&
                        element.scrollHeight -
                          element.clientHeight -
                          element.scrollTop <=
                          1,
                    ),
                ),
              )
              .toBe(true);
            await expect(footer.locator('a[href="/terms"]')).toBeVisible();
            await page.screenshot({
              path: `/tmp/life-public-reading-after-footer-${locale}-${width}.png`,
              fullPage: false,
            });
            await footer.locator('a[href="/terms"]').click();
            await waitForUiSettled(page);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              english ? "Terms of Service" : "服务条款",
            );
            await page
              .context()
              .grantPermissions(["clipboard-read", "clipboard-write"]);
            const foreign: string[] = [];
            page.on("request", (request) => {
              const url = new URL(request.url());
              if (
                ["http:", "https:"].includes(url.protocol) &&
                url.origin !== isolatedWorker.origin
              )
                foreign.push(request.url());
            });
            for (const [path, title] of [
              ["/terms", english ? "Terms of Service" : "服务条款"],
              ["/privacy", english ? "Privacy Policy" : "隐私政策"],
              [
                "/guides/markdown-support",
                english ? "Comment formatting" : "评论格式指南",
              ],
              ["/usage/mobile", "Life@USTC"],
              ["/usage/bot", english ? "Meet Presto" : "认识 Presto"],
              [
                "/usage/cli",
                english ? "Life@USTC in your terminal" : "终端里的 Life@USTC",
              ],
              [
                "/usage/mcp?client=claude",
                english ? "Connect with MCP" : "通过 MCP 连接",
              ],
            ]) {
              const response = await gotoAndWaitForReady(page, path);
              expect(response?.status()).toBe(200);
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                title,
              );
              await expect(page.getByTestId("demo-notice")).toContainText(
                english
                  ? "Changes and external actions are disabled."
                  : "无法修改数据或执行外部操作。",
              );
              await noExternalActions(page, isolatedWorker.origin);
              await expectNoPageHorizontalOverflow(page);
              if (path === "/terms") {
                await expect(
                  page.locator('[data-slot="legal-document"]'),
                ).toContainText(
                  english
                    ? "By using Life@USTC, you agree to the following terms."
                    : "使用 Life@USTC 即表示你同意以下服务条款。",
                );
                await page.locator("#main-content").focus();
                await page.keyboard.press("Control+Home");
                await expect
                  .poll(() =>
                    page.evaluate(
                      () =>
                        document.scrollingElement !== null &&
                        [
                          document.scrollingElement,
                          ...document.querySelectorAll(
                            "[data-shell-scroll-container]",
                          ),
                        ].every((element) => element.scrollTop === 0),
                    ),
                  )
                  .toBe(true);
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toBeInViewport({ ratio: 1 });
                await page.screenshot({
                  path: `/tmp/life1556-after-legal-${locale}-${width}.png`,
                  fullPage: true,
                });
              }
              if (path === "/privacy") {
                const unavailable = page.locator(
                  '[data-slot="legal-document"] a[aria-disabled="true"]',
                );
                await expect(unavailable).toHaveCount(1);
                await expect(unavailable).not.toHaveAttribute("href");
                await expect(unavailable).toHaveAttribute(
                  "aria-description",
                  /.+/,
                );
              }
              if (path === "/guides/markdown-support") {
                await expect(
                  page.locator('[data-slot="markdown-preview"] table'),
                ).toHaveCount(1);
                await expect(
                  page.locator('[data-slot="markdown-preview"] .katex'),
                ).not.toHaveCount(0);
                await expect(
                  page.locator('img[src="/images/icon.png"]'),
                ).toBeVisible();
              }
              if (
                path === "/usage/mobile" ||
                path === "/usage/bot" ||
                path === "/usage/cli"
              )
                await expect(
                  page
                    .getByTestId("demo-information-document")
                    .locator(
                      'button[aria-describedby="demo-information-reason"]:disabled',
                    ),
                ).toHaveCount(1);
              if (path === "/usage/cli") {
                await page
                  .getByRole("button", {
                    name: english
                      ? "Copy install command go install github.com/Life-USTC/CLI/cmd/life-ustc@latest"
                      : "复制安装命令 go install github.com/Life-USTC/CLI/cmd/life-ustc@latest",
                    exact: true,
                  })
                  .click();
                await expect
                  .poll(() =>
                    page.evaluate(() => navigator.clipboard.readText()),
                  )
                  .toBe(
                    "go install github.com/Life-USTC/CLI/cmd/life-ustc@latest",
                  );
              }
            }
            await expect(
              page.getByRole("tab", { name: /Claude/ }),
            ).toHaveAttribute("aria-selected", "true");
            await page
              .getByRole("button", {
                name: english ? "Copy MCP endpoint" : "复制 MCP 端点",
                exact: true,
              })
              .click();
            await expect
              .poll(() => page.evaluate(() => navigator.clipboard.readText()))
              .toBe("https://life-ustc.tiankaima.dev/api/mcp");
            const chatgptUrl = new URL(page.url());
            chatgptUrl.searchParams.set("client", "chatgpt");
            await page.getByRole("tab", { name: /ChatGPT/ }).click();
            await expect(page).toHaveURL(chatgptUrl.href);
            await waitForUiSettled(page);
            await noExternalActions(page, isolatedWorker.origin);
            await expect(
              page
                .getByTestId("demo-information-document")
                .locator('a[download="life-ustc-chatgpt-icon.png"]'),
            ).toHaveAttribute("href", "/images/usage/mcp-chatgpt-icon.png");
            const otherUrl = new URL(page.url());
            otherUrl.searchParams.set("client", "other");
            await page
              .getByRole("tab", {
                name: english ? /Other agents/ : /其他客户端/,
              })
              .click();
            await expect(page).toHaveURL(otherUrl.href);
            await waitForUiSettled(page);
            await expect(
              page.getByRole("button", { name: /codex mcp add/ }),
            ).toBeEnabled();
            await page.getByRole("button", { name: /codex mcp add/ }).click();
            await expect
              .poll(() => page.evaluate(() => navigator.clipboard.readText()))
              .toContain("codex mcp login life-ustc");
            if (english) {
              await expect(
                page
                  .getByTestId("demo-information-document")
                  .locator('span.sr-only[aria-live="polite"]'),
              ).toHaveText("Copied");
              await page.evaluate(() =>
                Object.assign(window, { informationLocaleDocument: true }),
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
              await expect(page.locator("html")).toHaveAttribute(
                "lang",
                "zh-cn",
              );
              await waitForUiSettled(page);
              // The real language control reloads the document; it is not a soft owner switch.
              expect(
                await page.evaluate(
                  () => "informationLocaleDocument" in window,
                ),
              ).toBe(false);
              expect(new URL(page.url()).searchParams.get("client")).toBe(
                "other",
              );
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                "通过 MCP 连接",
              );
              await expect(
                page.getByRole("tab", { name: /其他客户端/ }),
              ).toHaveAttribute("aria-selected", "true");
              await expect(
                page
                  .getByTestId("demo-information-document")
                  .locator('span.sr-only[aria-live="polite"]'),
              ).toHaveText("");
              await expect(page.getByTestId("demo-notice")).toContainText(
                "无法修改数据或执行外部操作。",
              );
              await expect(page.getByTestId("demo-notice")).not.toContainText(
                "Changes and external actions are disabled.",
              );
              await noExternalActions(page, isolatedWorker.origin);
            }
            await page.locator("#main-content").focus();
            await page.keyboard.press("Control+Home");
            await expect
              .poll(() =>
                page.evaluate(
                  () =>
                    document.scrollingElement !== null &&
                    [
                      document.scrollingElement,
                      ...document.querySelectorAll(
                        "[data-shell-scroll-container]",
                      ),
                    ].every((element) => element.scrollTop === 0),
                ),
              )
              .toBe(true);
            await expectRenderedUiQuality(page);
            // The no-outbound window covers Demo reading; ordinary analytics after exit is isolated by the existing workflow.
            expect(foreign).toEqual([]);
            if (english) {
              const [exit] = await Promise.all([
                page.waitForResponse(
                  (response) =>
                    new URL(response.url()).pathname === "/account/demo/exit" &&
                    response.request().method() === "POST",
                ),
                page
                  .getByRole("button", { name: "退出演示", exact: true })
                  .click(),
              ]);
              expect(exit.status()).toBe(303);
              await waitForUiSettled(page);
              await expect(page.getByTestId("demo-notice")).toHaveCount(0);
              await page.goBack();
              await waitForUiSettled(page);
              expect(new URL(page.url()).pathname).toBe("/usage/mcp");
              expect(new URL(page.url()).searchParams.get("client")).toBe(
                "other",
              );
              await expect(page.getByTestId("demo-notice")).toHaveCount(0);
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                "通过 MCP 连接",
              );
            }
          }),
        ),
      ),
    );
  });
}

test("demo information retires a held real ordinary document after same-document mode change", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor();
          await isolatedWorker.database.owner.user.update({
            where: { id: actor.id },
            data: {
              name: "Ordinary information owner",
              username: "information-owner",
            },
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
          await gotoAndWaitForReady(page, "/usage/mcp?client=chatgpt");
          await expect(page.getByTestId("demo-notice")).toHaveCount(0);
          await expect(
            page.getByRole("link", {
              name: "Open ChatGPT Plugins, select +, then Add custom MCP server.",
              exact: true,
            }),
          ).toHaveAttribute(
            "href",
            "https://developers.openai.com/api/docs/guides/custom-mcp-server",
          );
          const originalDocument = await page.evaluateHandle(() => document);
          const captured = createDeferred(),
            release = createDeferred();
          void captured.promise.catch(() => undefined);
          const operations: Promise<void>[] = [],
            errors: unknown[] = [];
          let held: Request | undefined,
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
              new Error(
                "Information page closed before ordinary document capture",
              ),
            );
          };
          const pattern = "**/terms/__data.json*";
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const body: unknown = await response.json();
              if (!isRecord(body) || !Array.isArray(body.nodes))
                throw new Error("Expected real ordinary terms page data");
              const decoded: Record<string, unknown>[] = [];
              for (const node of body.nodes) {
                if (!isRecord(node) || !Array.isArray(node.data)) continue;
                const data: unknown = unflatten(node.data);
                if (!isRecord(data))
                  throw new Error("Expected a decoded ordinary data node");
                decoded.push(data);
              }
              const data: Record<string, unknown> = Object.assign(
                {},
                ...decoded,
              );
              expect(data).toMatchObject({
                pageDemo: null,
                pageLocale: "en-us",
                content: { title: "Terms of Service" },
              });
              if (held) throw new Error("Duplicate ordinary document capture");
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
            const navigation = page
              .locator('footer a[href="/terms"]')
              .filter({ visible: true })
              .click();
            operations.push(navigation);
            void navigation.catch((error: unknown) => {
              errors.push(error);
              captured.reject(error);
            });
            await captured.promise;
            await demo(page, isolatedWorker.origin, "en-us");
            await page
              .locator('footer a[href="/privacy"]')
              .filter({ visible: true })
              .click();
            await waitForUiSettled(page);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Privacy Policy",
            );
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            expect(
              await originalDocument.evaluate(
                (document) => document === window.document,
              ),
            ).toBe(true);
            await noExternalActions(page, isolatedWorker.origin);
            await page.evaluate(() => {
              const state = {
                leak: false,
                observer: null as MutationObserver | null,
              };
              const forbidden = (node: Node) =>
                node instanceof Element &&
                (node.matches('a[href^="http"]') ||
                  Boolean(node.querySelector('a[href^="http"]')));
              state.observer = new MutationObserver((records) => {
                const current = document.querySelector(
                  '[data-testid="demo-information-document"]',
                );
                if (current?.querySelector('a[href^="http"]'))
                  state.leak = true;
                for (const record of records) {
                  if (
                    record.type === "attributes" &&
                    record.attributeName === "href" &&
                    record.oldValue?.startsWith("http")
                  )
                    state.leak = true;
                  for (const node of [
                    ...record.addedNodes,
                    ...record.removedNodes,
                  ])
                    if (forbidden(node)) state.leak = true;
                }
              });
              state.observer.observe(
                document.querySelector("#main-content") ?? document.body,
                {
                  subtree: true,
                  childList: true,
                  attributes: true,
                  attributeOldValue: true,
                  attributeFilter: ["href"],
                },
              );
              Object.assign(window, { demoInformationLate: state });
            });
            release.resolve();
            await Promise.all(operations);
            await expect.poll(() => terminal).toMatch(/finished|failed/);
            if (terminal === "failed")
              expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Privacy Policy",
            );
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await noExternalActions(page, isolatedWorker.origin);
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoInformationLate: {
                    leak: boolean;
                    observer: MutationObserver;
                  };
                };
                state.demoInformationLate.observer.disconnect();
                return state.demoInformationLate.leak;
              }),
            ).toBe(false);
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("Information document control finished"));
            try {
              await page.unroute(pattern);
            } catch (error) {
              errors.push(error);
            }
            await Promise.allSettled(operations);
            page.off("close", closing);
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
            await originalDocument.dispose();
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Held information document failed",
            );
        }),
      ),
    ),
  );
});

test("demo information expires its own document without reviving external controls", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await demo(page, isolatedWorker.origin, "en-us");
          await page.clock.install({ time: Date.now() });
          await gotoAndWaitForReady(page, "/usage/mcp?client=other");
          await expect(
            page.getByTestId("demo-information-document"),
          ).toBeVisible();
          await expect(
            page.getByRole("tab", { name: /Other agents/ }),
          ).toHaveAttribute("aria-selected", "true");
          await page.clock.fastForward(901_000);
          await expect(
            page.getByTestId("demo-information-document"),
          ).toHaveCount(0);
          await expect(page.getByRole("heading", { level: 1 })).toHaveCount(0);
          await expect(
            page.locator('#main-content a[href^="http"]'),
          ).toHaveCount(0);
        }),
      ),
    ),
  );
});
