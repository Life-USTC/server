import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";
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
const tag = "/api/docs/tag/catalog-section";
const operation = `${tag}/GET/api/catalog/sections`;
const reference = (page: Page) => page.locator("#api-reference");
async function demoCookie(
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
async function ready(page: Page, single = false) {
  await expect(
    reference(page).getByRole("heading", {
      level: 1,
      name: single ? "GET /api/catalog/sections" : "catalog.section",
      exact: true,
    }),
  ).toBeVisible();
}
async function sealed(page: Page) {
  await expect(page.getByTestId("demo-notice")).toBeVisible();
  await expect(reference(page).locator(".show-api-client-button")).toHaveCount(
    0,
  );
  await expect(
    reference(page).getByRole("button", {
      name: /^(Authorize|Test Request|Send Request|Generate SDK)$/i,
    }),
  ).toHaveCount(0);
  await expect(
    reference(page).getByRole("textbox", {
      name: /auth|bearer|token|api.?key|password|server/i,
    }),
  ).toHaveCount(0);
  await expect(
    reference(page).getByRole("combobox", {
      name: /auth|bearer|token|api.?key|password|server/i,
    }),
  ).toHaveCount(0);
  expect(
    await reference(page)
      .locator("a[href]")
      .evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              node instanceof HTMLAnchorElement &&
              new URL(node.href).origin !== location.origin,
          )
          .map((node) => node.getAttribute("href")),
      ),
  ).toEqual([]);
}
async function readable(locator: Locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(() => document.fonts.ready);
  await locator.scrollIntoViewIfNeeded();
  const facts = await locator.evaluate((root) => {
    let count = 0;
    const failures: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        count++;
        if (
          rect.left < 0 ||
          rect.right > document.documentElement.clientWidth ||
          rect.top < 0 ||
          rect.bottom > innerHeight
        )
          failures.push(node.textContent ?? "");
        for (
          let parent = node.parentElement;
          parent;
          parent = parent.parentElement
        ) {
          const css = getComputedStyle(parent),
            box = parent.getBoundingClientRect();
          if (
            (/^(auto|scroll|hidden|clip)$/.test(css.overflowX) &&
              (rect.left < box.left + parseFloat(css.borderLeftWidth) ||
                rect.right > box.right - parseFloat(css.borderRightWidth))) ||
            (/^(auto|scroll|hidden|clip)$/.test(css.overflowY) &&
              (rect.top < box.top + parseFloat(css.borderTopWidth) ||
                rect.bottom > box.bottom - parseFloat(css.borderBottomWidth)))
          )
            failures.push(node.textContent ?? "");
        }
      }
    }
    return { count, failures };
  });
  expect(facts.count).toBeGreaterThan(0);
  expect(facts.failures).toEqual([]);
}
async function navigateOperation(page: Page, width: number) {
  if (width === 390)
    await page.getByTestId("api-docs-mobile-navigation-trigger").click();
  const nav =
    width === 390
      ? page.getByTestId("api-docs-mobile-navigation-panel")
      : page.getByTestId("api-docs-desktop-navigation");
  await nav
    .getByRole("link", { name: "GET List sections", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${operation}$`));
  await ready(page, true);
  // Scalar lazily mounts operation details below the endpoint overview.
  await reference(page)
    .getByRole("list", { name: "catalog.section endpoints" })
    .scrollIntoViewIfNeeded();
}
for (const [locale, width] of [
  ["en-us", 1280],
  ["zh-cn", 390],
] as const)
  test(`demo API docs retain readable reference and disable execution ${locale} ${width}`, {
    tag: "@Account/Web",
  }, async ({ page, isolatedWorker, run }) => {
    await withBrowserWorkflow(page, (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            await page.setViewportSize({ width, height: 844 });
            await demoCookie(page, isolatedWorker.origin, locale);
            const foreign: string[] = [],
              executions: string[] = [],
              popups: string[] = [];
            const requested = (request: Request) => {
              const url = new URL(request.url());
              if (url.origin !== isolatedWorker.origin)
                foreign.push(url.origin);
              if (
                url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/api/docs/") &&
                url.pathname !== "/api/openapi"
              )
                executions.push(`${request.method()} ${url.pathname}`);
            };
            const popup = (child: Page) => popups.push(child.url());
            page.on("request", requested);
            page.on("popup", popup);
            try {
              const response = await gotoAndWaitForReady(page, tag);
              expect(response?.status()).toBe(200);
              await ready(page);
              await sealed(page);
              await readable(page.getByTestId("demo-notice"));
              await navigateOperation(page, width);
              await sealed(page);
              await expect(reference(page)).toContainText("List sections");
              await expect(reference(page)).toContainText("Responses");
              await readable(
                reference(page).getByRole("heading", {
                  level: 1,
                  name: "GET /api/catalog/sections",
                  exact: true,
                }),
              );
              // Closing mobile navigation restores focus to its trigger. Read the
              // reference before exercising the SDK shortcut, rather than reopening it.
              await reference(page)
                .getByRole("heading", {
                  level: 1,
                  name: "GET /api/catalog/sections",
                  exact: true,
                })
                .click();
              if (width === 390)
                await expect(
                  page.getByTestId("api-docs-mobile-navigation-trigger"),
                ).toHaveAttribute("aria-expanded", "false");
              await page.keyboard.press("Control+Enter");
              if (width === 390)
                await expect(
                  page.getByTestId("api-docs-mobile-navigation-panel"),
                ).toBeHidden();
              await sealed(page);
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
                    ].map((node) => node.scrollTop),
                  })),
                )
                .toEqual({ document: 0, regions: [0] });
              await expectNoPageHorizontalOverflow(page);
              await expectRenderedUiQuality(page);
              await page.screenshot({
                path: `/tmp/life1557-after-docs-${locale}-${width}.png`,
                fullPage: width === 390,
              });
              expect(foreign).toEqual([]);
              expect(executions).toEqual([]);
              expect(popups).toEqual([]);
            } finally {
              page.off("request", requested);
              page.off("popup", popup);
            }
          }),
        ),
      ),
    );
  });

test("demo API docs retire a real ordinary Scalar import across same-component mode and locale navigation", {
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
          const release = createDeferred(),
            captured = createDeferred<Request>(),
            operations: Promise<void>[] = [],
            errors: unknown[] = [];
          void captured.promise.catch(() => undefined);
          let held = false,
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
              new Error("Closed before owned Scalar import settled"),
            );
          };
          const pattern = /\/_app\/immutable\/.*\.js(?:\?|$)/;
          const handler = (route: Route) => {
            const operation = (async () => {
              const response = await route.fetch({ maxRedirects: 0 });
              expect(response.status()).toBe(200);
              const body = await response.text();
              if (
                !held &&
                body.includes("ui:open:client-modal") &&
                body.includes("hideTestRequestButton")
              ) {
                held = true;
                actual = route.request();
                captured.resolve(actual);
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
          page.on("requestfinished", finished);
          page.on("requestfailed", failed);
          page.on("close", closing);
          try {
            await page.route(pattern, handler);
            await page.goto(tag, { waitUntil: "domcontentloaded" });
            await captured.promise;
            await expect(
              page.getByTestId("api-docs-desktop-navigation"),
            ).toBeVisible();
            const proof = await page
              .locator("#main-content h1")
              .evaluate((heading) => {
                Object.assign(window, {
                  demoDocsProof: {
                    document,
                    heading,
                    token: crypto.randomUUID(),
                  },
                });
                return true;
              });
            expect(proof).toBe(true);
            await demoCookie(page, isolatedWorker.origin);
            await page
              .getByTestId("api-docs-desktop-navigation")
              .getByRole("link", { name: "GET List sections", exact: true })
              .click();
            await expect(page).toHaveURL(new RegExp(`${operation}$`));
            await expect(page.getByTestId("demo-notice")).toContainText(
              "Demo account",
            );
            // This await intentionally occurs after the current owner has been read; the real module is then released.
            release.resolve();
            for (let i = 0; i < operations.length; i++) await operations[i];
            await expect.poll(() => terminal).toBeTruthy();
            expect(["finished", "net::ERR_ABORTED"]).toContain(terminal);
            await ready(page, true);
            await sealed(page);
            expect(
              await page.evaluate(() => {
                const proof = (
                  window as Window & {
                    demoDocsProof?: { document: Document; heading: Element };
                  }
                ).demoDocsProof;
                return (
                  proof?.document === document &&
                  proof.heading === document.querySelector("#main-content h1")
                );
              }),
            ).toBe(true);
            await page.context().addCookies([
              {
                name: "NEXT_LOCALE",
                value: "zh-cn",
                url: isolatedWorker.origin,
              },
            ]);
            await page
              .getByTestId("api-docs-desktop-navigation")
              .getByRole("link", { name: "catalog.section", exact: true })
              .click();
            await expect(page.getByTestId("demo-notice")).toContainText(
              "演示账户",
            );
            await ready(page);
            await sealed(page);
            expect(
              await page.evaluate(() => {
                const proof = (
                  window as Window & {
                    demoDocsProof?: { document: Document; heading: Element };
                  }
                ).demoDocsProof;
                return (
                  proof?.document === document &&
                  proof.heading === document.querySelector("#main-content h1")
                );
              }),
            ).toBe(true);
          } catch (error) {
            errors.push(error);
          } finally {
            release.resolve();
            try {
              for (let i = 0; i < operations.length; i++) await operations[i];
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            }
            try {
              await page.unroute(pattern, handler);
            } catch (error) {
              errors.push(error);
            }
            page.off("requestfinished", finished);
            page.off("requestfailed", failed);
            page.off("close", closing);
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Owned Scalar import retirement failed",
            );
        }),
      ),
    ),
  );
});

test("demo API docs clear a real expired owner and rebuild after native exit and re-entry", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          const issuedAt = Math.floor(Date.now() / 1000) - 885;
          await demoCookie(page, isolatedWorker.origin, "en-us", issuedAt);
          await gotoAndWaitForReady(page, operation);
          await ready(page, true);
          await sealed(page);
          await page.waitForFunction(
            (deadline) => Date.now() >= deadline,
            (issuedAt + 900) * 1000,
          );
          await expect(reference(page).getByRole("heading")).toHaveCount(0);
          await expect(
            page.getByTestId("api-docs-desktop-navigation").getByRole("link"),
          ).toHaveCount(0);
          await page
            .getByRole("button", { name: "Exit demo", exact: true })
            .click();
          await expect(page).toHaveURL(/\/account\/sign-in$/);
          await page
            .getByRole("button", { name: "Enter demo", exact: true })
            .click();
          await expect(page).toHaveURL(/\/workspace\/todos$/);
          await gotoAndWaitForReady(page, operation);
          await ready(page, true);
          await sealed(page);
        }),
      ),
    ),
  );
});

test("demo document links reject dynamic external anchors through native activation", {
  tag: "@Account/Web",
}, async ({ page, isolatedWorker, run }) => {
  await withBrowserWorkflow(page, (workflow) =>
    workflow.run(() =>
      run(() =>
        workflow.body(async () => {
          await page.setViewportSize({ width: 1280, height: 844 });
          await demoCookie(page, isolatedWorker.origin);
          const attempted: string[] = [],
            popups: Page[] = [],
            errors: unknown[] = [];
          const marker = `owned-guard-${crypto.randomUUID()}`;
          const pattern = "https://example.invalid/**";
          const blockedOperations: Promise<void>[] = [];
          const block = (route: Route) => {
            attempted.push(route.request().url());
            const operation = route.abort("blockedbyclient");
            blockedOperations.push(operation);
            void operation.catch((error: unknown) => errors.push(error));
            return operation;
          };
          const popup = (child: Page) => popups.push(child);
          try {
            await page.context().route(pattern, block);
            page.on("popup", popup);
            await gotoAndWaitForReady(page, operation);
            await ready(page, true);
            await sealed(page);
            // Adversarial guard input only: these are not product links or screenshot content.
            await reference(page).evaluate((root, marker) => {
              const external = document.createElement("a");
              external.dataset.ownedDocumentLink = marker;
              external.href = `https://example.invalid/${marker}`;
              external.target = "_blank";
              external.textContent = "Owned external-link guard input";
              const internal = document.createElement("a");
              internal.dataset.ownedDocumentLink = `${marker}-internal`;
              internal.href = "#owned-document-link-target";
              internal.textContent = "Owned same-document guard input";
              root.append(external, internal);
            }, marker);
            const external = reference(page).locator(
              `[data-owned-document-link="${marker}"]`,
            );
            const internal = reference(page).locator(
              `[data-owned-document-link="${marker}-internal"]`,
            );
            await expect(external).not.toHaveAttribute("href");
            await expect(external).toHaveAttribute("aria-disabled", "true");
            await expect(external).toHaveAttribute("tabindex", "-1");
            await expect(external).toHaveAttribute("aria-description", /.+/);
            await expect(internal).toHaveAttribute(
              "href",
              "#owned-document-link-target",
            );
            await expect(internal).not.toHaveAttribute("aria-disabled");
            await external.click({ button: "middle" });
            await external.focus();
            await page.keyboard.press("Enter");
            await page.keyboard.press("Space");
            const response = await page.request.get("/api/openapi");
            expect(response.status()).toBe(200);
            await response.body();
            await sealed(page);
            expect(attempted).toEqual([]);
            expect(popups).toEqual([]);
          } catch (error) {
            errors.push(error);
          } finally {
            if (!page.isClosed()) {
              try {
                await page
                  .locator("[data-owned-document-link]")
                  .evaluateAll((nodes, marker) => {
                    for (const node of nodes)
                      if (
                        node
                          .getAttribute("data-owned-document-link")
                          ?.startsWith(marker)
                      )
                        node.remove();
                  }, marker);
              } catch (error) {
                errors.push(error);
              }
            }
            page.off("popup", popup);
            try {
              await page.context().unroute(pattern, block);
              for (const operation of blockedOperations) await operation;
            } catch (error) {
              if (!errors.includes(error)) errors.push(error);
            }
            for (const child of popups)
              try {
                await child.close();
              } catch (error) {
                errors.push(error);
              }
          }
          if (errors.length)
            throw new AggregateError(
              errors,
              "Native document guard or cleanup failed",
            );
        }),
      ),
    ),
  );
});

test("demo API docs destroy existing ordinary credential fields and the real request client", {
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
          const marker = `owned-auth-input-${crypto.randomUUID()}`;
          let demoPhase = false;
          const executions: string[] = [],
            ordinaryForeign: string[] = [],
            foreign: string[] = [],
            popups: Page[] = [];
          const requested = (request: Request) => {
            const url = new URL(request.url());
            if (url.origin !== isolatedWorker.origin)
              (demoPhase ? foreign : ordinaryForeign).push(request.url());
            if (
              url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/api/docs/") &&
              url.pathname !== "/api/openapi"
            )
              executions.push(`${request.method()} ${url.pathname}`);
          };
          const popup = (child: Page) => popups.push(child);
          page.on("request", requested);
          page.on("popup", popup);
          try {
            await gotoAndWaitForReady(page, operation);
            await ready(page, true);
            const authType = reference(page).getByRole("button", {
              name: "Select Auth Type",
              exact: true,
            });
            await expect(authType).toHaveCount(1);
            await authType.click();
            await page
              .getByRole("option", { name: "bearerAuth", exact: true })
              .click();
            await page.keyboard.press("Escape");
            const token = reference(page)
              .getByLabel("Bearer Token", { exact: true })
              .filter({ visible: true });
            await expect(token).toHaveCount(1);
            await token.fill(marker);
            await expect(token).toHaveValue(marker);
            // The marker is ordinary editable state only. It grants no identity and is never sent.
            // Auth belongs to the introduction; the real operation client mounts lazily below it.
            await reference(page)
              .getByRole("list", { name: "catalog.section endpoints" })
              .scrollIntoViewIfNeeded();
            const testRequest = reference(page).locator(
              "button.show-api-client-button",
            );
            await expect(testRequest).toHaveCount(1);
            await testRequest.click();
            const client = page.getByRole("dialog", {
              name: "API Client",
              exact: true,
            });
            await expect(client).toBeVisible();
            await client
              .getByRole("button", { name: "Close Client", exact: true })
              .click();
            await expect(client).toBeHidden();
            await expect(token).toHaveValue(marker);
            const pageHeading = page.getByRole("heading", {
              level: 1,
              name: "API Documentation",
              exact: true,
            });
            await pageHeading.evaluate((heading) => {
              Object.assign(window, {
                demoDocsCredentialProof: { document, heading },
              });
            });
            // Keep ordinary analytics observations; every attempt from the cookie switch onward is Demo.
            demoPhase = true;
            await demoCookie(page, isolatedWorker.origin);
            await page
              .getByTestId("api-docs-desktop-navigation")
              .getByRole("link", { name: "catalog.section", exact: true })
              .click();
            await expect(page.getByTestId("demo-notice")).toContainText(
              "Demo account",
            );
            await ready(page);
            await sealed(page);
            expect(
              await pageHeading.evaluate((heading) => {
                const proof = (
                  window as Window & {
                    demoDocsCredentialProof?: {
                      document: Document;
                      heading: Element;
                    };
                  }
                ).demoDocsCredentialProof;
                return (
                  proof?.document === document && proof.heading === heading
                );
              }),
            ).toBe(true);
            const values = () =>
              page
                .locator("input,textarea")
                .evaluateAll(
                  (nodes, marker) =>
                    nodes.filter(
                      (node) =>
                        (node instanceof HTMLInputElement ||
                          node instanceof HTMLTextAreaElement) &&
                        node.value.includes(marker),
                    ).length,
                  marker,
                );
            expect(await values()).toBe(0);
            await expect(page.locator("body")).not.toContainText(marker);
            await expect(
              page.getByRole("dialog", {
                name: "API Client",
                exact: true,
                includeHidden: true,
              }),
            ).toHaveCount(0);
            await page.evaluate((marker) => {
              const state = {
                leaked: false,
                observer: undefined as MutationObserver | undefined,
              };
              const check = () => {
                if (
                  (document.body.textContent ?? "").includes(marker) ||
                  [...document.querySelectorAll("input,textarea")].some(
                    (node) =>
                      (node instanceof HTMLInputElement ||
                        node instanceof HTMLTextAreaElement) &&
                      node.value.includes(marker),
                  )
                )
                  state.leaked = true;
              };
              state.observer = new MutationObserver(check);
              state.observer.observe(document.body, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
              });
              Object.assign(window, { demoDocsCredentialObserver: state });
            }, marker);
            await navigateOperation(page, 1280);
            await sealed(page);
            const spec = await page.request.get("/api/openapi");
            expect(spec.status()).toBe(200);
            await spec.body();
            expect(await values()).toBe(0);
            expect(
              await page.evaluate(
                () =>
                  (
                    window as Window & {
                      demoDocsCredentialObserver?: { leaked: boolean };
                    }
                  ).demoDocsCredentialObserver?.leaked,
              ),
            ).toBe(false);
            expect(executions).toEqual([]);
            // This one ordinary script is fulfilled by the existing owned analytics isolation.
            expect(ordinaryForeign).toEqual([
              "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R",
            ]);
            expect(foreign).toEqual([]);
            expect(popups).toEqual([]);
          } finally {
            if (!page.isClosed())
              await page.evaluate(() =>
                (
                  window as Window & {
                    demoDocsCredentialObserver?: {
                      observer?: MutationObserver;
                    };
                  }
                ).demoDocsCredentialObserver?.observer?.disconnect(),
              );
            page.off("request", requested);
            page.off("popup", popup);
            for (const child of popups) await child.close();
          }
        }),
      ),
    ),
  );
});
