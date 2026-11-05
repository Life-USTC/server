import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

const evidence = process.env.USAGE_EVIDENCE_DIR;
const phase = process.env.USAGE_EVIDENCE_PHASE ?? "after";
const evidenceLocale = process.env.USAGE_EVIDENCE_LOCALE ?? "en-us";

test("usage content remains readable in narrow desktop and tablet layouts", {
  tag: "@Site/Web",
}, async ({ page, publicFlow, isolatedWorker }) => {
  await publicFlow.run(async () => {
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: evidenceLocale,
        url: isolatedWorker.origin,
      },
    ]);
    if (evidence) await mkdir(evidence, { recursive: true });
    const capture = async (name: string) => {
      const visibleContent =
        name.startsWith("bot") || name.startsWith("cli")
          ? page.locator('[data-usage-marketing="example-card"]').first()
          : page.locator('[data-usage-marketing="page"]');
      await expect
        .poll(() =>
          visibleContent.evaluate((node) => {
            let current: Element | null = node;
            while (current) {
              if (Number(getComputedStyle(current).opacity) < 1) return false;
              current = current.parentElement;
            }
            return true;
          }),
        )
        .toBe(true);
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images]
            .filter(
              (img) =>
                img.getBoundingClientRect().bottom > 0 &&
                img.getBoundingClientRect().top < innerHeight,
            )
            .map((img) => img.decode().catch(() => undefined)),
        );
      });
      if (name.startsWith("bot") || name.startsWith("cli"))
        await visibleContent.evaluate((node) =>
          node.scrollIntoView({ block: "start" }),
        );
      await page.screenshot({
        path: join(evidence ?? "", `${phase}-${name}.png`),
      });
    };
    for (const width of [390, 768, 1024, 1144, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAndWaitForReady(page, "/usage/mcp");
      const hero = page.locator('[data-usage-marketing="hero"]');
      const figure = hero.locator("figure");
      if (evidence && [390, 1024].includes(width))
        await capture(`mcp-hero-${width}`);
      const box = await hero.boundingBox();
      const imageBox = await figure.boundingBox();
      expect(box).not.toBeNull();
      expect(imageBox).not.toBeNull();
      if (!box || !imageBox) throw new Error("Missing hero geometry");
      expect
        .soft(imageBox.x + imageBox.width)
        .toBeLessThanOrEqual(box.x + box.width + 1);
      for (const client of ["chatgpt", "claude", "other"]) {
        // Tabs use value in the ID, with labels stable in both locales.
        const selected =
          client === "chatgpt"
            ? page.getByRole("tab", { name: /ChatGPT/ })
            : client === "claude"
              ? page.getByRole("tab", { name: /Claude/ })
              : page.getByRole("tab").nth(2);
        await selected.click();
        await expect
          .poll(
            () => new URL(page.url()).searchParams.get("client") ?? "chatgpt",
          )
          .toBe(client);
        await expect(selected).toHaveAttribute("aria-selected", "true");
        const rail = await page.getByRole("tablist").boundingBox();
        if (!rail) throw new Error("Missing tab rail geometry");
        for (const item of await page.getByRole("tab").all()) {
          const rect = await item.boundingBox();
          if (!rect) throw new Error("Missing tab geometry");
          expect.soft(rect.y).toBeGreaterThanOrEqual(rail.y);
          expect
            .soft(rect.y + rect.height)
            .toBeLessThanOrEqual(rail.y + rail.height);
        }
        const codes = page.getByRole("tabpanel").locator("button code");
        for (const code of await codes.all()) {
          expect
            .soft(
              await code.evaluate(
                (node) => node.scrollWidth <= node.clientWidth + 1,
              ),
            )
            .toBe(true);
        }
      }
      await page.getByRole("tab", { name: /ChatGPT/ }).click();
      const cards = page.locator(
        '[data-usage-marketing="example-card"]:visible',
      );
      if (evidence && [390, 1024].includes(width)) {
        await cards
          .nth(1)
          .evaluate((node) => node.scrollIntoView({ block: "start" }));
        await capture(`mcp-steps-${width}`);
      }
      const boxes = await cards.evaluateAll((nodes) =>
        nodes.map((node) => {
          const b = node.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom };
        }),
      );
      expect.soft(boxes[1].top).toBeGreaterThanOrEqual(boxes[0].bottom);
      expect.soft(boxes[2].top).toBeGreaterThanOrEqual(boxes[1].bottom);
    }
    await page.setViewportSize({ width: 768, height: 900 });
    await gotoAndWaitForReady(page, "/usage/cli");
    const examples = page.locator('[data-usage-marketing="examples"]');
    if (evidence)
      await examples
        .locator('[data-usage-marketing="example-card"]')
        .first()
        .evaluate((node) => node.scrollIntoView({ block: "start" }));
    if (evidence) await capture("cli-768");
    for (const pre of await examples.locator("pre").all())
      expect
        .soft(await pre.evaluate((node) => getComputedStyle(node).whiteSpace))
        .toBe("pre");
    await gotoAndWaitForReady(page, "/usage/bot");
    if (evidence) {
      await page
        .locator('[data-usage-marketing="example-card"]')
        .first()
        .evaluate((node) => node.scrollIntoView({ block: "start" }));
      await capture("bot-768");
    }
    const schedule = page.getByRole("img", {
      name: /Presto 返回的本周课表图片|Weekly schedule image returned by Presto/,
    });
    const preview = page.getByRole("button", {
      name: /Presto 返回的本周课表图片|Weekly schedule image returned by Presto/,
    });
    expect.soft(await preview.count()).toBe(1);
    if (await preview.count()) {
      await preview.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("img")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(preview).toBeFocused();
    }
    await expect(schedule.first()).toBeVisible();
  });
});
