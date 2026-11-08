import {
  type APIResponse,
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
type SearchBody = {
  query: string;
  groups: {
    type: string;
    items: { id: string; title: string; href: string; external?: boolean }[];
  }[];
};
type Proof = {
  token: string;
  document: Document;
  h1: Element | null;
  leak: boolean;
  observer?: MutationObserver;
};
declare global {
  interface Window {
    demoSearchProof?: Proof;
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
async function searchBody(response: APIResponse): Promise<SearchBody> {
  expect(response.status()).toBe(200);
  const value: unknown = await response.json();
  if (
    !record(value) ||
    typeof value.query !== "string" ||
    !Array.isArray(value.groups) ||
    !value.groups.every(
      (g: unknown) =>
        record(g) &&
        typeof g.type === "string" &&
        Array.isArray(g.items) &&
        g.items.every(
          (i: unknown) =>
            record(i) &&
            typeof i.id === "string" &&
            typeof i.title === "string" &&
            typeof i.href === "string",
        ),
    )
  )
    throw new Error("Expected real global-search response DTO");
  return value as SearchBody;
}
const input = (page: Page) => page.locator("#global-search-page-input");
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: /^(Search|搜索)$/ });
const dialogInput = (page: Page) =>
  dialog(page).locator("#global-search-dialog-input");
const option = (scope: Locator, id: string, modal = false) =>
  scope.locator(
    `[id="${modal ? "global-search-dialog" : "global-search"}-item-${id}"]`,
  );
const pageResults = (page: Page) => page.locator("#global-search-listbox");
const visibleLink = (page: Page, slug: string) =>
  page.locator(`[data-catalog-link-slug="${slug}"]`).filter({ visible: true });
async function cookies(
  page: Page,
  origin: string,
  locale = "en-us",
  issuedAt = Math.floor(Date.now() / 1000),
) {
  await page.context().addCookies([
    { ...(await createSignedDemoCookie({ issuedAt })), url: origin },
    { name: "NEXT_LOCALE", value: locale, url: origin },
  ]);
}
async function hydrated(page: Page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.lifeUstcHydrated === "true",
  );
  await expect(page.locator("#main-content h1")).toHaveCount(1);
}
async function mark(page: Page) {
  return page.evaluate(() => {
    window.demoSearchProof = {
      token: crypto.randomUUID(),
      document,
      h1: document.querySelector("#main-content h1"),
      leak: false,
    };
    return window.demoSearchProof.token;
  });
}
async function sameDocument(page: Page, token: string, sameH1 = true) {
  expect(
    await page.evaluate(
      ({ token, sameH1 }) => {
        const p = window.demoSearchProof;
        return Boolean(
          p &&
            p.token === token &&
            p.document === document &&
            (!sameH1 || p.h1 === document.querySelector("#main-content h1")),
        );
      },
      { token, sameH1 },
    ),
  ).toBe(true);
}
async function observeForbidden(page: Page, text: string) {
  await page.evaluate((text) => {
    const p = window.demoSearchProof;
    if (!p) throw new Error("Missing original browser document proof");
    const forbidden = (node: Node | null) =>
      node?.textContent?.includes(text) ?? false;
    p.observer = new MutationObserver((changes) => {
      if (forbidden(document.querySelector("#main-content"))) p.leak = true;
      for (const change of changes) {
        if (
          change.oldValue?.includes(text) ||
          forbidden(change.target) ||
          [...change.addedNodes, ...change.removedNodes].some(forbidden)
        )
          p.leak = true;
      }
    });
    p.observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });
  }, text);
}
async function noLeak(page: Page, text: string) {
  await expect(page.locator("#main-content")).not.toContainText(text);
  expect(await page.evaluate(() => window.demoSearchProof?.leak)).toBe(false);
}
async function textFits(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(() => document.fonts.ready);
  await locator.scrollIntoViewIfNeeded();
  const facts = await locator.evaluate((root) => {
    const failures: unknown[] = [];
    let rectangles = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        rectangles++;
        if (
          rect.left < 0 ||
          rect.right > document.documentElement.clientWidth ||
          rect.top < 0 ||
          rect.bottom > innerHeight
        )
          failures.push({
            text: node.textContent,
            rect: rect.toJSON(),
            viewport: [document.documentElement.clientWidth, innerHeight],
          });
        for (let e = node.parentElement; e; e = e.parentElement) {
          const css = getComputedStyle(e),
            b = e.getBoundingClientRect();
          if (
            (/^(hidden|clip|auto|scroll)$/.test(css.overflowX) &&
              (rect.left < b.left + Number.parseFloat(css.borderLeftWidth) ||
                rect.right >
                  b.right - Number.parseFloat(css.borderRightWidth))) ||
            (/^(hidden|clip|auto|scroll)$/.test(css.overflowY) &&
              (rect.top < b.top + Number.parseFloat(css.borderTopWidth) ||
                rect.bottom >
                  b.bottom - Number.parseFloat(css.borderBottomWidth)))
          )
            failures.push({
              text: node.textContent,
              rect: rect.toJSON(),
              clip: b.toJSON(),
            });
        }
      }
    }
    return { rectangles, failures };
  });
  expect(facts.rectangles).toBeGreaterThan(0);
  expect(facts.failures).toEqual([]);
}
async function fourGroups(page: Page, modal = false) {
  const root = modal ? dialog(page) : pageResults(page);
  const prefix = modal ? "global-search-dialog" : "global-search";
  await expect(root.locator(`p[id^="${prefix}-group-"]`)).toHaveCount(4);
  for (const type of ["sections", "courses", "homeworks", "todos"])
    await expect(root.locator(`[id="${prefix}-group-${type}"]`)).toBeVisible();
  await expect(option(root, "section:910001", modal)).toBeVisible();
  await expect(option(root, "course:920001", modal)).toBeVisible();
  await expect(
    option(root, "homework:demo-homework-project", modal),
  ).toBeVisible();
  await expect(option(root, "todo:demo-todo-reading", modal)).toBeVisible();
}
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return result;
}
async function withDemoProbe(
  page: Page,
  worker: IsolatedWorker,
  body: () => Promise<void>,
) {
  const secret = { "x-test-storage-secret": "local-test-storage-observer" },
    id = crypto.randomUUID(),
    path = `/__test/community-effects?id=${id}`;
  const before = await snapshot(worker),
    errors: unknown[] = [],
    writes: string[] = [],
    foreign: string[] = [];
  const registration = await page.request.post(`${worker.origin}${path}&io=1`, {
    headers: secret,
  });
  await registration.body();
  expect(registration.status()).toBe(201);
  const pattern = (url: URL) =>
    url.origin === worker.origin &&
    /^(?:\/api\/|\/_internal\/)/.test(url.pathname);
  const operations: Promise<void>[] = [];
  const join = async () => {
    for (let i = 0; i < operations.length; i++) await operations[i];
  };
  const handler = (route: Route) => {
    const operation = (async () => {
      await route.fallback({
        headers: {
          ...(await route.request().allHeaders()),
          ...secret,
          "x-test-community-probe": id,
        },
      });
    })();
    operations.push(operation);
    void operation.catch((error: unknown) => errors.push(error));
    return operation;
  };
  const requested = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin !== worker.origin) foreign.push(url.origin);
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method()) &&
      url.pathname !== "/api/account/preferences"
    )
      writes.push(`${request.method()} ${url.pathname}`);
  };
  try {
    page.on("request", requested);
    await page.route(pattern, handler);
    await body();
    await join();
    const effects = await page.request.get(`${worker.origin}${path}`, {
      headers: secret,
    });
    expect(effects.status()).toBe(200);
    expect(await effects.json()).toMatchObject({
      io: { bindings: [], outbound: [] },
      backgroundErrors: [],
    });
    expect(await snapshot(worker)).toEqual(before);
    expect(writes).toEqual([]);
    expect(foreign).toEqual([]);
  } catch (error) {
    errors.push(error);
  } finally {
    try {
      await page.unroute(pattern, handler);
      await join();
    } catch (error) {
      if (!errors.includes(error)) errors.push(error);
    }
    page.off("request", requested);
    try {
      const removed = await page.request.delete(`${worker.origin}${path}`, {
        headers: secret,
      });
      await removed.body();
      expect(removed.status()).toBe(204);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Demo search effects or browser workflow failed",
    );
}
type Held = {
  request: Request;
  response: APIResponse;
  url: string;
  release: () => void;
  join: () => Promise<void>;
  terminal: () => string | undefined;
};
async function withHeld(
  page: Page,
  pattern: RegExp,
  accepts: (request: Request, response: APIResponse) => Promise<boolean>,
  body: (captured: Promise<Held>) => Promise<void>,
) {
  const release = createDeferred(),
    captured = createDeferred<Held>(),
    errors: unknown[] = [],
    operations: Promise<void>[] = [];
  void captured.promise.catch(() => undefined);
  let holding = true,
    actual: Request | undefined,
    terminal: string | undefined;
  const finished = (request: Request) => {
    if (request === actual) terminal = "finished";
  };
  const failed = (request: Request) => {
    if (request === actual) terminal = request.failure()?.errorText;
  };
  const closing = () => {
    release.resolve();
    captured.reject(
      new Error("Browser closed before the owned held response completed"),
    );
  };
  const join = async () => {
    for (let i = 0; i < operations.length; i++) await operations[i];
  };
  const handler = (route: Route) => {
    const operation = (async () => {
      if (!holding) return route.fallback();
      const response = await route.fetch({ maxRedirects: 0 });
      const accepted = await accepts(route.request(), response);
      if (accepted && holding) {
        holding = false;
        actual = route.request();
        captured.resolve({
          request: actual,
          response,
          url: actual.url(),
          release: () => release.resolve(),
          join,
          terminal: () => terminal,
        });
        await release.promise;
      }
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
    await body(captured.promise);
  } catch (error) {
    errors.push(error);
  } finally {
    release.resolve();
    try {
      await join();
    } catch (error) {
      if (!errors.includes(error)) errors.push(error);
    }
    try {
      await page.unroute(pattern, handler);
    } catch (error) {
      errors.push(error);
    }
    page.off("close", closing);
    page.off("requestfinished", finished);
    page.off("requestfailed", failed);
    if (!page.isClosed())
      await page
        .evaluate(() => window.demoSearchProof?.observer?.disconnect())
        .catch((error: unknown) => errors.push(error));
  }
  if (errors.length)
    throw new AggregateError(
      errors,
      "Held search callback or browser workflow failed",
    );
}
async function terminal(held: Held) {
  held.release();
  await held.join();
  await expect.poll(held.terminal).toBeTruthy();
  expect(["finished", "net::ERR_ABORTED"]).toContain(held.terminal());
}
async function viewAll(page: Page, english = true) {
  await dialog(page)
    .getByRole("button", {
      name: english ? "View all search results" : "查看全部搜索结果",
      exact: true,
    })
    .click();
}

for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const) {
  test(`demo search: page, keyboard and internal website navigation ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const en = locale === "en-us",
              query = en ? "algebra" : "线性代数";
            await page.setViewportSize({ width, height: 844 });
            await cookies(page, isolatedWorker.origin, locale);
            await withDemoProbe(page, isolatedWorker, async () => {
              const response = await gotoAndWaitForReady(
                page,
                `/search?q=${encodeURIComponent(query)}`,
              );
              expect(response?.status()).toBe(200);
              await expect(page.getByTestId("demo-notice")).toBeVisible();
              await fourGroups(page);
              for (const item of await pageResults(page)
                .getByRole("option")
                .all())
                await textFits(item);
              await textFits(page.getByTestId("demo-notice"));
              await page.locator("[data-shell-scroll-container]").focus();
              await page.keyboard.press("Control+Home");
              await waitForUiSettled(page);
              await expect
                .poll(() =>
                  page.evaluate(() => ({
                    document: document.scrollingElement?.scrollTop ?? 0,
                    regions: [
                      ...document.querySelectorAll(
                        "[data-shell-scroll-container]",
                      ),
                    ].map((element) => element.scrollTop),
                  })),
                )
                .toEqual({ document: 0, regions: [0] });
              await expect
                .poll(() =>
                  page.locator("#main-content h1").evaluate((heading) => {
                    const rect = heading.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                      rect.left + rect.width / 2,
                      rect.top + rect.height / 2,
                    );
                    return (
                      rect.top >= 0 &&
                      rect.bottom <= innerHeight &&
                      Boolean(hit && heading.contains(hit))
                    );
                  }),
                )
                .toBe(true);
              await expectNoPageHorizontalOverflow(page);
              await expectRenderedUiQuality(page);
              await page.screenshot({
                path: `/tmp/life1554-after-search-page-${locale}-${width}.png`,
                fullPage: width === 390,
              });
              await page
                .getByRole("button", {
                  name: en ? /^Open search(?:\s|$)/ : /^打开搜索(?:\s|$)/,
                })
                .filter({ visible: true })
                .click();
              await expect(dialog(page)).toBeVisible();
              await expect(
                dialog(page).getByTestId("demo-search-notice"),
              ).toContainText(en ? "Read only" : "只读");
              await dialogInput(page).fill(query);
              await fourGroups(page, true);
              expect(
                await page.locator("[id]").evaluateAll((nodes) => {
                  const ids = nodes.map((node) => node.id);
                  return ids.filter((id, i) => ids.indexOf(id) !== i);
                }),
              ).toEqual([]);
              for (const item of await dialog(page).getByRole("option").all())
                await textFits(item);
              await textFits(dialog(page).getByTestId("demo-search-notice"));
              await expectRenderedUiQuality(page);
              await dialogInput(page).focus();
              await dialogInput(page).press("ArrowDown");
              await expect(
                option(dialog(page), "section:910001", true),
              ).toBeFocused();
              await expect(
                option(pageResults(page), "section:910001"),
              ).not.toBeFocused();
              await page.keyboard.press("Enter");
              await expect(page).toHaveURL(/\/catalog\/sections\/910001$/);
              await waitForUiSettled(page);
              await page.goBack();
              await expect(input(page)).toHaveValue(query);
              await fourGroups(page);
              const composing = en ? "project" : "项目";
              await input(page).evaluate((node, value) => {
                if (!(node instanceof HTMLInputElement))
                  throw new Error("Expected the native search input");
                node.value = value;
                node.dispatchEvent(
                  new InputEvent("input", {
                    bubbles: true,
                    isComposing: true,
                    inputType: "insertCompositionText",
                    data: value,
                  }),
                );
              }, composing);
              await input(page).dispatchEvent("compositionend", {
                data: composing,
              });
              await expect(page).toHaveURL(
                new RegExp(`q=${encodeURIComponent(composing)}`),
              );
              const homework = option(
                pageResults(page),
                "homework:demo-homework-project",
              );
              await expect(homework).toBeVisible();
              await homework.click();
              await expect(page).toHaveURL(
                /\/catalog\/sections\/910001\?homeworkId=demo-homework-project#homework$/,
              );
              await expect(
                page.getByRole("dialog", {
                  name: en ? "Linear algebra team project" : "线性代数小组项目",
                  exact: true,
                }),
              ).toBeVisible();
              await page.keyboard.press("Escape");
              await page.keyboard.press("Control+k");
              await expect(dialog(page)).toBeVisible();
              await dialogInput(page).fill(en ? "Library" : "图书馆");
              await expect(
                option(dialog(page), "link:library", true),
              ).toBeVisible();
              await option(dialog(page), "link:library", true).click();
              await expect(page).toHaveURL(/\/catalog\/links#link-library$/);
              await expect(visibleLink(page, "library")).toBeFocused();
              const directorySearch = page.locator(
                width === 390
                  ? "#catalog-link-search-mobile"
                  : "#catalog-link-search-desktop",
              );
              await directorySearch.fill("no-such-owned-website");
              await page.locator("#links-filters button[type=submit]").click();
              await expect(visibleLink(page, "library")).toHaveCount(0);
              await page.keyboard.press("Control+k");
              await dialogInput(page).fill(en ? "Library" : "图书馆");
              await expect(
                option(dialog(page), "link:library", true),
              ).toBeVisible();
              await option(dialog(page), "link:library", true).click();
              await expect(visibleLink(page, "library")).toBeFocused();
              await expect(directorySearch).toHaveValue("");
              await expect(
                page
                  .locator('form[action="/api/workspace/link-pins"]')
                  .filter({ visible: true }),
              ).toHaveCount(65);
              const websiteActions = visibleLink(page, "library").getByRole(
                "button",
              );
              await expect(websiteActions.first()).toBeVisible();
              for (const action of await websiteActions.all())
                await expect(action).toBeDisabled();
              await expect(
                page.locator(
                  '#main-content a[href*="/api/catalog/links/resolve"]',
                ),
              ).toHaveCount(0);
              await page
                .getByRole("link", { name: /^Life@USTC:/ })
                .filter({ visible: true })
                .click();
              await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
              await waitForUiSettled(page);
              await page.keyboard.press("Control+k");
              await expect(dialog(page)).toBeVisible();
              await dialogInput(page).fill(query);
              await fourGroups(page, true);
              await textFits(dialog(page).getByTestId("demo-search-notice"));
              await expectRenderedUiQuality(page);
              await page.screenshot({
                path: `/tmp/life1554-after-search-entry-${locale}-${width}.png`,
              });
            });
          }),
        ),
      ),
    );
  });
}

test("demo search: held ordinary page response retires with same-query owner", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          const actor = await isolatedWorker.createActor(),
            privateTitle = `Private algebra search ${crypto.randomUUID()}`;
          await isolatedWorker.database.owner.todo.create({
            data: { userId: actor.id, title: privateTitle },
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
          await withHeld(
            page,
            /\/api\/search(?:\?|$)/,
            async (request, response) => {
              const url = new URL(request.url());
              if (
                url.searchParams.get("q") !== "algebra" ||
                url.searchParams.get("scope") !== "workspace"
              )
                return false;
              const body = await searchBody(response);
              expect(
                body.groups
                  .flatMap((group) => group.items)
                  .map((item) => item.title),
              ).toContain(privateTitle);
              return true;
            },
            async (capture) => {
              await page.goto("/search?q=algebra", {
                waitUntil: "domcontentloaded",
              });
              await hydrated(page);
              const held = await capture,
                token = await mark(page);
              await page.context().clearCookies({ name: actor.cookie.name });
              await cookies(page, isolatedWorker.origin);
              await withDemoProbe(page, isolatedWorker, async () => {
                await page.keyboard.press("Control+k");
                await dialogInput(page).fill("algebra");
                await fourGroups(page, true);
                const fresh = page.waitForResponse((response) => {
                  const url = new URL(response.url());
                  return (
                    url.pathname === "/api/search" &&
                    url.searchParams.get("q") === "algebra" &&
                    url.searchParams.get("limit") === "20" &&
                    response.request() !== held.request
                  );
                });
                await viewAll(page);
                const actual = await fresh;
                expect(actual.status()).toBe(200);
                await expect(page.getByTestId("demo-notice")).toBeVisible();
                await fourGroups(page);
                await sameDocument(page, token);
                await expect(dialog(page)).toHaveCount(0);
                await waitForUiSettled(page);
                await observeForbidden(page, privateTitle);
                await terminal(held);
                await fourGroups(page);
                await sameDocument(page, token);
                await noLeak(page, privateTitle);
              });
            },
          );
        }),
      ),
    ),
  );
});

test("demo search: old lazy import cannot reopen after a same-document Demo entry", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: "en-us",
              url: isolatedWorker.origin,
            },
          ]);
          await gotoAndWaitForReady(page, "/");
          const token = await mark(page);
          await withHeld(
            page,
            /\/_app\/immutable\/.*\.js(?:\?|$)/,
            async (_request, response) => {
              expect(response.status()).toBe(200);
              return (await response.text()).includes(
                "global-search-dialog-input",
              );
            },
            async (capture) => {
              await page.keyboard.press("Control+k");
              const held = await capture;
              expect(await held.response.text()).toContain(
                "global-search-dialog-input",
              );
              await cookies(page, isolatedWorker.origin);
              await page
                .getByRole("link", { name: "Life@USTC: Home", exact: true })
                .filter({ visible: true })
                .click();
              await expect(page.getByTestId("demo-notice")).toBeVisible();
              await sameDocument(page, token, false);
              await terminal(held);
              // Await evaluation of the exact real module, without fabricating its contents or UI.
              await page.evaluate(async (url) => {
                await import(url);
              }, held.url);
              await waitForUiSettled(page);
              await expect(dialog(page)).toHaveCount(0);
              await page.keyboard.press("Control+k");
              await expect(dialog(page)).toBeVisible();
              await expect(
                dialog(page).getByTestId("demo-search-notice"),
              ).toContainText("Read only");
            },
          );
        }),
      ),
    ),
  );
});

test("demo search: actual signed-session expiry clears results and blocks reopening", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          const issuedAt = Math.floor(Date.now() / 1000) - 885,
            expiresAt = (issuedAt + 900) * 1000;
          await cookies(page, isolatedWorker.origin, "en-us", issuedAt);
          const response = await gotoAndWaitForReady(page, "/search?q=algebra");
          expect(response?.status()).toBe(200);
          await fourGroups(page);
          expect(expiresAt).toBeGreaterThan(Date.now());
          // Real wall-clock deadline; no page clock, sleep, timeout or retry override.
          await page.waitForFunction(
            (deadline) => Date.now() >= deadline,
            expiresAt,
          );
          await expect(pageResults(page)).toHaveCount(0);
          await page.keyboard.press("Control+k");
          await expect(dialog(page)).toHaveCount(0);
          const expired = await page.request.get(
            `${isolatedWorker.origin}/api/search?q=algebra&scope=workspace&locale=en-us`,
          );
          expect(expired.status()).toBe(401);
          expect(await expired.json()).toEqual({
            error: "DEMO_SESSION_INVALID",
          });
        }),
      ),
    ),
  );
});

test("demo search: same-query locale change retires a held Demo response", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          await cookies(page, isolatedWorker.origin);
          await withHeld(
            page,
            /\/api\/search(?:\?|$)/,
            async (request, response) => {
              const url = new URL(request.url());
              if (
                url.searchParams.get("q") !== "algebra" ||
                url.searchParams.get("locale") !== "en-us" ||
                url.searchParams.get("limit") !== "20"
              )
                return false;
              const body = await searchBody(response);
              expect(
                body.groups.find((group) => group.type === "sections")?.items[0]
                  ?.title,
              ).toBe("Linear Algebra · Teacher Chen, Teacher Lin");
              return true;
            },
            async (capture) => {
              await page.goto("/search?q=algebra", {
                waitUntil: "domcontentloaded",
              });
              await hydrated(page);
              const held = await capture,
                token = await mark(page);
              await page.context().addCookies([
                {
                  name: "NEXT_LOCALE",
                  value: "zh-cn",
                  url: isolatedWorker.origin,
                },
              ]);
              await withDemoProbe(page, isolatedWorker, async () => {
                await page.keyboard.press("Control+k");
                await dialogInput(page).fill("algebra");
                await fourGroups(page, true);
                const actualZh = page.waitForResponse((response) => {
                  const url = new URL(response.url());
                  return (
                    url.pathname === "/api/search" &&
                    url.searchParams.get("q") === "algebra" &&
                    url.searchParams.get("locale") === "zh-cn" &&
                    url.searchParams.get("limit") === "20"
                  );
                });
                await viewAll(page);
                const zh = await actualZh;
                expect(zh.status()).toBe(200);
                const body: unknown = await zh.json();
                expect(body).toMatchObject({
                  query: "algebra",
                  groups: [{ type: "sections" }, { type: "courses" }],
                });
                await expect(
                  option(pageResults(page), "section:910001"),
                ).toContainText("线性代数");
                await sameDocument(page, token);
                await expect(dialog(page)).toHaveCount(0);
                await waitForUiSettled(page);
                await observeForbidden(page, "Linear Algebra");
                await terminal(held);
                await sameDocument(page, token);
                await expect(
                  option(pageResults(page), "section:910001"),
                ).toContainText("线性代数");
                await noLeak(page, "Linear Algebra");
              });
            },
          );
        }),
      ),
    ),
  );
});
