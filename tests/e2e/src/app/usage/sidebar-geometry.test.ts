import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

const endpoint = "https://life-ustc.tiankaima.dev/api/mcp";

for (const locale of ["en-us", "zh-cn"]) {
  for (const width of [1023, 1024, 1144, 1440]) {
    test(
      `MCP content fits both sidebar states ${locale} ${width}`,
      { tag: "@Site/Web" },
      async ({ page, publicFlow, isolatedWorker }, info) => {
        await publicFlow.run(async () => {
          await page.setViewportSize({ width, height: 900 });
          await page.context().addCookies([
            {
              name: "NEXT_LOCALE",
              value: locale,
              url: isolatedWorker.origin,
            },
          ]);
          await page
            .context()
            .grantPermissions(["clipboard-read", "clipboard-write"]);
          await gotoAndWaitForReady(page, "/usage/mcp");
          const sidebar = page.locator('[data-slot="sidebar"][data-state]');
          const hero = page.locator('[data-usage-marketing="hero"]');
          const tabs = page.getByRole("tab");
          const measurements: unknown[] = [];
          let railHeight: number | undefined;
          let tabHeights: number[] | undefined;
          for (const state of ["expanded", "collapsed"]) {
            if ((await sidebar.getAttribute("data-state")) !== state)
              await page.locator('[data-slot="sidebar-rail"]').click();
            await expect(sidebar).toHaveAttribute("data-state", state);
            await expect
              .poll(() =>
                sidebar
                  .locator('[data-slot="sidebar-gap"]')
                  .evaluate((node) =>
                    node
                      .getAnimations()
                      .every((animation) => animation.playState !== "running"),
                  ),
              )
              .toBe(true);
            for (const [index, client] of [
              "chatgpt",
              "claude",
              "other",
            ].entries()) {
              if (index === 1) {
                await tabs.nth(0).focus();
                await page.keyboard.press("ArrowRight");
                await expect(tabs.nth(1)).toBeFocused();
              } else {
                await tabs.nth(index).click();
              }
              await expect(tabs.nth(index)).toHaveAttribute(
                "aria-selected",
                "true",
              );
              await expect
                .poll(
                  () =>
                    new URL(page.url()).searchParams.get("client") ?? "chatgpt",
                )
                .toBe(client);
              if (client === "chatgpt") {
                await expect(hero.locator("figure")).toHaveCount(1);
                await expect
                  .poll(() =>
                    hero
                      .locator("figure img")
                      .evaluate(
                        (image) => (image as HTMLImageElement).naturalWidth,
                      ),
                  )
                  .toBeGreaterThan(0);
                const figure = hero.locator("figure");
                await figure.scrollIntoViewIfNeeded();
                await expect(figure).toBeInViewport({ ratio: 1 });
                await info.attach(`${state}-figure`, {
                  body: await figure.screenshot(),
                  contentType: "image/png",
                });
              } else {
                await expect(hero.locator("figure")).toHaveCount(0);
              }
              const panel = page.getByRole("tabpanel");
              await expect(panel).toHaveCount(1);
              await expect(panel).toBeVisible();
              const selectedId = await tabs.nth(index).getAttribute("id");
              if (!selectedId)
                throw new Error("Missing selected client tab ID");
              await expect(panel).toHaveAttribute(
                "aria-labelledby",
                selectedId,
              );
              const urlFields = panel.locator("button code").filter({
                hasText: /^https:\/\/life-ustc\.tiankaima\.dev\/api\/mcp$/,
              });
              await expect(urlFields).toHaveCount(1);
              await expect(urlFields).toHaveText(endpoint);
              const sentinel = `${locale}-${width}-${state}-${client}`;
              await page.evaluate(
                (value) => navigator.clipboard.writeText(value),
                sentinel,
              );
              await expect
                .poll(() => page.evaluate(() => navigator.clipboard.readText()))
                .toBe(sentinel);
              await urlFields.click();
              await expect
                .poll(() => page.evaluate(() => navigator.clipboard.readText()))
                .toBe(endpoint);
              await expect(
                urlFields
                  .locator("..", { has: page.locator("code") })
                  .locator(".."),
              ).toContainText(locale === "en-us" ? "Copied" : "已复制");
              const geometry = await panel.evaluate((panel) => {
                const box = (node: Element | null) => {
                  if (!node) throw new Error("Missing geometry element");
                  const rect = node.getBoundingClientRect();
                  return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    height: rect.height,
                  };
                };
                const hero = document.querySelector(
                  '[data-usage-marketing="hero"]',
                );
                const grid = hero?.firstElementChild;
                const rail = document.querySelector('[role="tablist"]');
                if (!hero || !grid || !rail)
                  throw new Error("Missing usage layout");
                const style = getComputedStyle(grid);
                const gridBox = box(grid);
                const content = {
                  left: gridBox.left + parseFloat(style.paddingLeft),
                  top: gridBox.top + parseFloat(style.paddingTop),
                  right: gridBox.right - parseFloat(style.paddingRight),
                  bottom: gridBox.bottom - parseFloat(style.paddingBottom),
                };
                const figure = hero.querySelector("figure");
                return {
                  content,
                  figure: figure ? box(figure) : null,
                  image: figure?.querySelector("img")
                    ? box(figure.querySelector("img"))
                    : null,
                  rail: box(rail),
                  tabs: [...rail.querySelectorAll('[role="tab"]')].map(box),
                  panel: box(panel),
                  steps: [
                    ...panel.querySelectorAll(
                      '[data-usage-marketing="example-card"]',
                    ),
                  ].map(box),
                  stepNumbers: [
                    ...panel.querySelectorAll(
                      '[data-usage-marketing="example-card"]',
                    ),
                  ].map((step) =>
                    step.querySelector("span")?.textContent?.trim(),
                  ),
                  textLines: [
                    ...panel.querySelectorAll(
                      "h3, h4, p, code, [data-usage-marketing=example-card] span",
                    ),
                  ].flatMap((node) => {
                    const range = document.createRange();
                    range.selectNodeContents(node);
                    return [...range.getClientRects()].map((rect) => ({
                      left: rect.left,
                      right: rect.right,
                    }));
                  }),
                  copyFields: [...panel.querySelectorAll("button code")].map(
                    (code) => ({
                      code: box(code),
                      button: box(code.closest("button")),
                      affordance: box(
                        code.closest("button")?.lastElementChild ?? null,
                      ),
                      completeWidth: code.scrollWidth <= code.clientWidth + 1,
                      completeHeight:
                        code.scrollHeight <= code.clientHeight + 1,
                    }),
                  ),
                };
              });
              measurements.push({ state, client, ...geometry });
              expect(geometry.textLines.length).toBeGreaterThan(0);
              expect(geometry.copyFields.length).toBeGreaterThan(0);
              expect(geometry.panel.right).toBeGreaterThan(geometry.panel.left);
              expect(geometry.panel.height).toBeGreaterThan(0);
              expect(geometry.steps).toHaveLength(client === "other" ? 0 : 3);
              expect(geometry.stepNumbers).toEqual(
                client === "other" ? [] : ["01", "02", "03"],
              );
              for (const step of geometry.steps)
                expect(step.height).toBeGreaterThan(0);
              if (geometry.figure) {
                if (!geometry.image)
                  throw new Error("Missing hero image geometry");
                for (const item of [geometry.figure, geometry.image]) {
                  expect(item.left).toBeGreaterThanOrEqual(
                    geometry.content.left - 1,
                  );
                  expect(item.top).toBeGreaterThanOrEqual(
                    geometry.content.top - 1,
                  );
                  expect(item.right).toBeLessThanOrEqual(
                    geometry.content.right + 1,
                  );
                  expect(item.bottom).toBeLessThanOrEqual(
                    geometry.content.bottom + 1,
                  );
                }
              }
              railHeight ??= geometry.rail.height;
              expect(geometry.rail.height).toBeCloseTo(railHeight, 1);
              tabHeights ??= geometry.tabs.map((tab) => tab.height);
              for (const [index, tab] of geometry.tabs.entries()) {
                expect(tab.height).toBeCloseTo(tabHeights[index], 1);
                const above = tab.top - geometry.rail.top;
                const below = geometry.rail.bottom - tab.bottom;
                expect(above).toBeGreaterThanOrEqual(0);
                expect(below).toBeGreaterThanOrEqual(0);
                expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
                expect(tab.left).toBeGreaterThanOrEqual(geometry.rail.left);
                expect(tab.right).toBeLessThanOrEqual(geometry.rail.right);
              }
              for (const [index, step] of geometry.steps.entries()) {
                expect(step.left).toBeGreaterThanOrEqual(
                  geometry.panel.left - 1,
                );
                expect(step.right).toBeLessThanOrEqual(
                  geometry.panel.right + 1,
                );
                if (index)
                  expect(step.top).toBeGreaterThanOrEqual(
                    geometry.steps[index - 1].bottom,
                  );
              }
              for (const line of geometry.textLines) {
                expect(line.left).toBeGreaterThanOrEqual(
                  geometry.panel.left - 1,
                );
                expect(line.right).toBeLessThanOrEqual(
                  geometry.panel.right + 1,
                );
              }
              for (const field of geometry.copyFields) {
                expect(field.code.right).toBeLessThanOrEqual(
                  field.affordance.left + 1,
                );
                expect(field.completeWidth).toBe(true);
                expect(field.completeHeight).toBe(true);
                expect(field.code.left).toBeGreaterThanOrEqual(
                  field.button.left,
                );
                expect(field.code.right).toBeLessThanOrEqual(
                  field.button.right,
                );
                expect(field.code.top).toBeGreaterThanOrEqual(field.button.top);
                expect(field.code.bottom).toBeLessThanOrEqual(
                  field.button.bottom,
                );
              }
            }
          }
          await info.attach("content-geometry", {
            body: Buffer.from(
              JSON.stringify({ locale, width, measurements }, null, 2),
            ),
            contentType: "application/json",
          });
        });
      },
    );
  }
}
