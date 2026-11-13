import { createHash } from "node:crypto";
import { expect, type Request, type Route } from "@playwright/test";
import { unflatten } from "devalue";
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
const scenes = [
  { family: "list", path: "/news", locale: "en-us", width: 1280 },
  { family: "list", path: "/news", locale: "zh-cn", width: 390 },
  { family: "detail", path: "/news/demo-news-1", locale: "en-us", width: 390 },
  { family: "detail", path: "/news/demo-news-1", locale: "zh-cn", width: 1280 },
  { family: "sources", path: "/news/sources", locale: "en-us", width: 1280 },
  { family: "sources", path: "/news/sources", locale: "zh-cn", width: 390 },
] as const;
const rows = (page: import("@playwright/test").Page) =>
  page.locator('#main-content li h2 a[href^="/news/demo-news-"]');
for (const { family, path, locale, width } of scenes) {
  test(`demo news: existing ${family} ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const english = locale === "en-us";
            await page.setViewportSize({ width, height: 844 });
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000),
            });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
            await gotoAndWaitForReady(page, path);
            await expect(page.getByTestId("demo-notice")).toBeVisible();
            await expect(page.getByTestId("demo-news-fictional")).toContainText(
              english ? "fixed fictional samples" : "固定虚构样例",
            );
            if (family === "list") {
              await expect(rows(page)).toHaveCount(20);
              await expect(rows(page).first()).toHaveText(
                english ? "Sample reading room hours" : "虚构阅览室开放时间",
              );
            } else if (family === "detail") {
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                english ? "Sample reading room hours" : "虚构阅览室开放时间",
              );
              await expect(page.getByRole("table")).toContainText(
                english ? "Notebooks" : "笔记本",
              );
              const external = page.locator(
                'button[aria-describedby="demo-news-external-unavailable"]',
              );
              await expect(external).toBeDisabled();
              await expect(external).not.toHaveAttribute("href");
              await expect(
                page.locator("#demo-news-external-unavailable"),
              ).toContainText(
                english ? "fictional source page" : "虚构的来源页",
              );
              await expect(
                page.locator('a[href^="https://demo.invalid"]'),
              ).toHaveCount(0);
              const image = page.getByRole("img", {
                name: english ? "Fictional DEMO diagram" : "虚构 DEMO 示意图",
                exact: true,
              });
              await image.scrollIntoViewIfNeeded();
              await expect
                .poll(() =>
                  image.evaluate((element) => ({
                    complete: (element as HTMLImageElement).complete,
                    width: (element as HTMLImageElement).naturalWidth,
                    height: (element as HTMLImageElement).naturalHeight,
                  })),
                )
                .toEqual({ complete: true, width: 320, height: 120 });
              const attachment = page.locator(
                'a[download][href^="/api/publications/objects/asset/"]',
              );
              await expect(attachment).toHaveCount(1);
              await expect(attachment).toBeVisible();
              const [download] = await Promise.all([
                page.waitForEvent("download"),
                attachment.click(),
              ]);
              const downloaded = await download.createReadStream();
              if (!downloaded)
                throw new Error("Missing real attachment download stream");
              const chunks: Buffer[] = [];
              for await (const chunk of downloaded)
                chunks.push(Buffer.from(chunk));
              const bytes = Buffer.concat(chunks);
              const href = await attachment.getAttribute("href");
              expect(createHash("sha256").update(bytes).digest("hex")).toBe(
                href?.split("/").at(-1),
              );
              expect(bytes.toString("utf8")).toContain("DEMO ONLY");
              expect(bytes.toString("utf8")).toContain("不是学校通知");
              expect(download.suggestedFilename()).toMatch(/\.txt$/);
            } else {
              for (const id of [
                "demo-study",
                "demo-society",
                "demo-center",
                "demo-empty",
              ])
                await expect(
                  page.locator(`a[href="/news?source=${id}"]:visible`),
                ).toHaveCount(1);
              await expect(page.locator("#main-content")).toContainText(
                english ? "Fictional empty source" : "虚构空白来源",
              );
            }
            await expectRenderedUiQuality(page);
            await expectNoPageHorizontalOverflow(page);
            if (family === "detail" && locale === "en-us" && width === 390) {
              await page.locator("#main-content").focus();
              await page.keyboard.press("Control+Home");
              await expect
                .poll(() =>
                  page.evaluate(() => ({
                    document: document.scrollingElement?.scrollTop ?? 0,
                    regions: [
                      ...document.querySelectorAll(
                        "[data-shell-scroll-container]",
                      ),
                    ].map((node) => node.scrollTop),
                  })),
                )
                .toEqual({ document: 0, regions: [0] });
            } else
              await page
                .getByRole("heading", { level: 1 })
                .scrollIntoViewIfNeeded();
            await page.screenshot({
              path: `/tmp/life1534-after-${family}-${locale}-${width}.png`,
              fullPage: true,
            });
            if (family === "list") {
              await rows(page).nth(19).scrollIntoViewIfNeeded();
              await expect(rows(page)).toHaveCount(22);
              expect(
                new Set(
                  await rows(page).evaluateAll((links) =>
                    links.map(
                      (link) =>
                        new URL((link as HTMLAnchorElement).href).pathname,
                    ),
                  ),
                ).size,
              ).toBe(22);
              await gotoAndWaitForReady(page, "/news?fold=1");
              await expect(rows(page)).toHaveCount(20);
              await rows(page).nth(19).scrollIntoViewIfNeeded();
              await expect(rows(page)).toHaveCount(21);
              await expect(
                page.locator('a[href^="/news/demo-news-22"]'),
              ).toHaveCount(0);
              await page.locator('a[href^="/news/demo-news-21"]').click();
              await waitForUiSettled(page);
              const sibling = page.locator('a[href^="/news/demo-news-22"]');
              await expect(sibling).toHaveCount(1);
              await sibling.click();
              await waitForUiSettled(page);
              await expect(page.getByRole("heading", { level: 1 })).toHaveText(
                english ? "Fictional sample report 21" : "虚构样例报道 21",
              );
              await gotoAndWaitForReady(page, "/news");
              const search = page.locator('input[name="query"]');
              await search.fill(english ? "reading room" : "阅览室");
              await page
                .getByRole("button", {
                  name: english ? "Apply filters" : "应用筛选",
                  exact: true,
                })
                .click();
              await waitForUiSettled(page);
              await expect(rows(page)).toHaveCount(1);
              await expect(rows(page)).toHaveText(
                english ? "Sample reading room hours" : "虚构阅览室开放时间",
              );
              await gotoAndWaitForReady(
                page,
                "/news?source=demo-study&source=demo-society&organizationLevel=student&organizationLevel=society",
              );
              await expect(rows(page)).toHaveCount(15);
              await gotoAndWaitForReady(
                page,
                "/news?query=&type=&source=&organizationLevel=&fold=",
              );
              await expect(rows(page)).toHaveCount(20);
              if (english) {
                await page
                  .getByRole("button", { name: "More filters", exact: true })
                  .click();
                const filters = page.getByRole("dialog", {
                  name: "More filters",
                  exact: true,
                });
                for (const id of ["demo-study", "demo-society"])
                  await filters
                    .locator(`#publication-source-${id}`)
                    .setChecked(true);
                for (const level of ["student", "society"])
                  await filters
                    .locator(`#publication-level-${level}`)
                    .setChecked(true);
                await expect(rows(page)).toHaveCount(20);
                await filters
                  .getByRole("button", { name: "Apply filters", exact: true })
                  .click();
                await waitForUiSettled(page);
                await expect(rows(page)).toHaveCount(15);
                expect(
                  new URL(page.url()).searchParams.getAll("source").sort(),
                ).toEqual(["demo-society", "demo-study"]);
                expect(
                  new URL(page.url()).searchParams
                    .getAll("organizationLevel")
                    .sort(),
                ).toEqual(["society", "student"]);
              }
            } else if (family === "sources") {
              await page
                .locator('a[href="/news?source=demo-empty"]:visible')
                .click();
              await waitForUiSettled(page);
              await expect(rows(page)).toHaveCount(0);
              await expect(
                page.getByRole("heading", { level: 1 }),
              ).toBeVisible();
              await expect(
                page.getByTestId("demo-news-fictional"),
              ).toBeVisible();
              await expect(
                page.locator('[data-slot="endless-scroll"]'),
              ).toHaveCount(0);
            }
          }),
        ),
      ),
    );
  });
}

test("demo news: same-page mode change retires a real held next page", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const db = isolatedWorker.database.owner;
          const actor = await isolatedWorker.createActor();
          const source = await db.publicationSource.create({
            data: {
              id: `ordinary-${crypto.randomUUID()}`,
              name: "Ordinary fixture source",
            },
          });
          for (let index = 1; index <= 22; index++) {
            const title = `Ordinary fixture article ${index}`;
            const record = await db.publication.create({
              data: {
                sourceId: source.id,
                canonicalUrl: `https://example.invalid/ordinary/${index}`,
                title,
                publicationType: "news",
              },
            });
            const revision = await db.publicationRevision.create({
              data: {
                publicationId: record.id,
                revisionHash: createHash("sha256").update(title).digest("hex"),
                title,
                publicationType: "news",
                observedAt: new Date("2026-09-24T09:00:00+08:00"),
                bodyText: "Owned ordinary article, without remote objects.",
              },
            });
            await db.publication.update({
              where: { id: record.id },
              data: { currentRevisionId: revision.id },
            });
          }
          await page.setViewportSize({ width: 1280, height: 844 });
          await page.context().addCookies([
            actor.cookie,
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
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
              new Error("News closed before real next page capture"),
            );
          };
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const envelope = await response.json();
              const data = unflatten(envelope.nodes.at(-1).data) as {
                publications: {
                  data: { id: string; revision: { title: string } }[];
                  pagination: { page: number; total: number };
                };
              };
              expect(data.publications.pagination).toMatchObject({
                page: 2,
                total: 22,
              });
              expect(data.publications.data).toHaveLength(2);
              const ordinary = data.publications.data.every((row) =>
                row.revision.title.startsWith("Ordinary fixture article"),
              );
              if (ordinary) {
                if (held) throw new Error("Duplicate held ordinary next page");
                held = route.request();
                captured.resolve();
                await release.promise;
              } else
                expect(data.publications.data.map((row) => row.id)).toEqual([
                  "demo-news-21",
                  "demo-news-22",
                ]);
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
          const pattern = "**/news/__data.json?**";
          try {
            page.on("close", closing);
            page.on("requestfinished", finished);
            page.on("requestfailed", failed);
            await page.route(pattern, async (route) => {
              if (
                new URL(route.request().url()).searchParams.get("page") === "2"
              )
                return handler(route);
              return route.continue();
            });
            await gotoAndWaitForReady(page, "/news");
            const ordinary = page.locator(
              '#main-content li h2 a[href^="/news/"]',
            );
            await expect(ordinary).toHaveCount(20);
            await expect(ordinary.first()).toContainText(
              "Ordinary fixture article",
            );
            await ordinary.nth(19).scrollIntoViewIfNeeded();
            await captured.promise;
            await page.evaluate(() => {
              const state = {
                heading: document.querySelector("#main-content h1"),
                leak: false,
                observer: null as MutationObserver | null,
              };
              state.observer = new MutationObserver(() => {
                if (
                  document.querySelector(
                    '[data-testid="demo-news-fictional"]',
                  ) &&
                  document
                    .querySelector("#main-content")
                    ?.textContent?.includes("Ordinary fixture article")
                )
                  state.leak = true;
              });
              state.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
              });
              Object.assign(window, { demoNewsMode: state });
            });
            await page.context().clearCookies();
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000),
            });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            const current = page.locator(
              '[data-shell-navigation="desktop"] a[data-sidebar="menu-button"][href="/news"]',
            );
            await expect(current).toHaveCount(1);
            await current.click();
            await expect(page.getByTestId("demo-news-fictional")).toBeVisible();
            await expect(rows(page).first()).toHaveText(
              "Sample reading room hours",
            );
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoNewsMode?: { heading: Element | null };
                };
                return Boolean(
                  state.demoNewsMode &&
                    state.demoNewsMode.heading ===
                      document.querySelector("#main-content h1"),
                );
              }),
            ).toBe(true);
            release.resolve();
            await Promise.all(operations);
            await expect.poll(() => terminal).toMatch(/finished|failed/);
            if (terminal === "failed")
              expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
            await page
              .locator('a[href^="/news/demo-news-20"]')
              .scrollIntoViewIfNeeded();
            await expect(rows(page)).toHaveCount(22);
            await expect(page.locator("#main-content")).not.toContainText(
              "Ordinary fixture article",
            );
            expect(
              await page.evaluate(() => {
                const state = window as typeof window & {
                  demoNewsMode: { leak: boolean; observer: MutationObserver };
                };
                state.demoNewsMode.observer.disconnect();
                return state.demoNewsMode.leak;
              }),
            ).toBe(false);
          } catch (error) {
            if (!errors.includes(error)) errors.push(error);
          } finally {
            release.resolve();
            captured.reject(new Error("News owner control ended"));
            try {
              await page.unroute(pattern);
            } catch (error) {
              errors.push(error);
            }
            await Promise.allSettled(operations);
            page.off("close", closing);
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Held news next-page workflow failed",
            );
        }),
      ),
    ),
  );
});

for (const transition of [
  "same-page locale",
  "locale",
  "exit and re-entry",
] as const) {
  test(`demo news: ${transition} retires a real held English next page`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const demo = await createSignedDemoCookie({
              issuedAt: Math.floor(Date.now() / 1000) - 120,
            });
            await page.setViewportSize({ width: 1280, height: 844 });
            await page.context().addCookies([
              { ...demo, url: isolatedWorker.origin },
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            const captured = createDeferred(),
              release = createDeferred();
            void captured.promise.catch(() => undefined);
            const operations: Promise<void>[] = [],
              errors: unknown[] = [];
            let held: Request | undefined,
              terminal: "finished" | "failed" | undefined;
            let fulfilled = false;
            const finished = (request: Request) => {
              if (request === held) terminal = "finished";
            };
            const failed = (request: Request) => {
              if (request === held) terminal = "failed";
            };
            const closing = () => {
              release.resolve();
              captured.reject(
                new Error("News transition closed before capture"),
              );
            };
            const pattern = "**/news/__data.json?**";
            const handler = (route: Route) => {
              if (
                new URL(route.request().url()).searchParams.get("page") !== "2"
              )
                return route.continue();
              const operation = (async () => {
                const response = await route.fetch({ maxRedirects: 0 });
                expect(response.status()).toBe(200);
                const envelope = await response.json();
                const data = unflatten(envelope.nodes.at(-1).data) as {
                  publications: {
                    data: { id: string; revision: { title: string } }[];
                    pagination: { page: number; total: number };
                  };
                };
                expect(data.publications.pagination).toMatchObject({
                  page: 2,
                  total: 22,
                });
                expect(data.publications.data.map((row) => row.id)).toEqual([
                  "demo-news-21",
                  "demo-news-22",
                ]);
                const english = data.publications.data.every(
                  (row) => row.revision.title === "Fictional sample report 21",
                );
                if (english) {
                  if (held) throw new Error("Duplicate held English next page");
                  held = route.request();
                  captured.resolve();
                  await release.promise;
                } else
                  expect(
                    data.publications.data.map((row) => row.revision.title),
                  ).toEqual(["虚构样例报道 21", "虚构样例报道 21"]);
                await route.fulfill({ response }).catch((error: unknown) => {
                  if (
                    route.request().failure()?.errorText !== "net::ERR_ABORTED"
                  )
                    throw error;
                });
                if (english) fulfilled = true;
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
              await gotoAndWaitForReady(page, "/news");
              await expect(rows(page)).toHaveCount(20);
              await rows(page).nth(19).scrollIntoViewIfNeeded();
              await captured.promise;
              await page.evaluate(() =>
                Object.assign(window, {
                  demoNewsDocument: {
                    heading: document.querySelector("#main-content h1"),
                  },
                }),
              );
              if (transition === "exit and re-entry") {
                await page
                  .getByRole("button", { name: "Exit demo", exact: true })
                  .click();
                await expect(page).toHaveURL(/\/account\/sign-in$/);
                expect(
                  await page.evaluate(() => "demoNewsDocument" in window),
                ).toBe(false);
                await waitForUiSettled(page);
              }
              if (transition === "same-page locale") {
                await page.context().addCookies([
                  {
                    name: "NEXT_LOCALE",
                    value: "zh-cn",
                    url: isolatedWorker.origin,
                  },
                ]);
                await page
                  .locator(
                    '[data-shell-navigation="desktop"] a[data-sidebar="menu-button"][href="/news"]',
                  )
                  .click();
              } else {
                await page
                  .getByRole("button", {
                    name: "Language selector",
                    exact: true,
                  })
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
                await expect(page.locator("html")).toHaveAttribute(
                  "lang",
                  "zh-cn",
                );
              }
              if (transition === "exit and re-entry") {
                await page
                  .getByRole("button", { name: "进入演示", exact: true })
                  .click();
                await expect(page).toHaveURL(/\/workspace\/todos$/);
                await gotoAndWaitForReady(page, "/news");
                expect(
                  await page.evaluate(() => "demoNewsDocument" in window),
                ).toBe(false);
              } else if (transition === "same-page locale")
                expect(
                  await page.evaluate(() => {
                    const state = window as typeof window & {
                      demoNewsDocument?: { heading: Element | null };
                    };
                    return Boolean(
                      state.demoNewsDocument &&
                        state.demoNewsDocument.heading ===
                          document.querySelector("#main-content h1"),
                    );
                  }),
                ).toBe(true);
              if (transition === "locale")
                expect(
                  await page.evaluate(() => "demoNewsDocument" in window),
                ).toBe(false);
              await expect(rows(page).first()).toHaveText("虚构阅览室开放时间");
              await expect(page.getByTestId("demo-notice")).toContainText(
                "演示账户",
              );
              await page.evaluate(() => {
                const state = {
                  leak: false,
                  observer: null as MutationObserver | null,
                };
                state.observer = new MutationObserver(() => {
                  if (
                    /Sample reading room hours|Fictional sample report 21/.test(
                      document.querySelector("#main-content")?.textContent ??
                        "",
                    )
                  )
                    state.leak = true;
                });
                const content = document.querySelector("#main-content");
                if (!content) throw new Error("Missing news content");
                state.observer.observe(content, {
                  subtree: true,
                  childList: true,
                  characterData: true,
                });
                Object.assign(window, { demoNewsLocale: state });
              });
              release.resolve();
              await Promise.all(operations);
              expect(fulfilled).toBe(true);
              if (transition === "same-page locale") {
                await expect.poll(() => terminal).toMatch(/finished|failed/);
                if (terminal === "failed")
                  expect(held?.failure()?.errorText).toBe("net::ERR_ABORTED");
              }
              // Exit retires the original document; its fulfilled route callback is joined above.
              await page
                .locator('a[href^="/news/demo-news-20"]')
                .scrollIntoViewIfNeeded();
              await expect(rows(page)).toHaveCount(22);
              expect(
                new Set(
                  await rows(page).evaluateAll((links) =>
                    links.map((link) => (link as HTMLAnchorElement).pathname),
                  ),
                ).size,
              ).toBe(22);
              await expect(page.locator("#main-content")).not.toContainText(
                "Fictional sample report 21",
              );
              expect(
                await page.evaluate(() => {
                  const state = window as typeof window & {
                    demoNewsLocale: {
                      leak: boolean;
                      observer: MutationObserver;
                    };
                  };
                  state.demoNewsLocale.observer.disconnect();
                  return state.demoNewsLocale.leak;
                }),
              ).toBe(false);
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            } finally {
              release.resolve();
              captured.reject(new Error("News transition control ended"));
              try {
                await page.unroute(pattern, handler);
              } catch (error) {
                errors.push(error);
              }
              await Promise.allSettled(operations);
              page.off("close", closing);
              page.off("requestfinished", finished);
              page.off("requestfailed", failed);
            }
            if (errors.length)
              throw new AggregateError(
                errors,
                "News transition workflow failed",
              );
          }),
        ),
      ),
    );
  });
}
