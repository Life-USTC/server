import { expect, type Locator, type Page } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test } from "../../../utils/public-worker";

const endpoint = "https://life-ustc.tiankaima.dev/api/mcp";

function endpointCopyButton(page: Page) {
  return page
    .getByRole("tabpanel")
    .locator("button code")
    .filter({ hasText: /^https:\/\/life-ustc\.tiankaima\.dev\/api\/mcp$/ })
    .locator("xpath=ancestor::button");
}

type ClipboardCompletionControl = {
  pendingCount: () => number;
  release: (index: number) => Promise<void>;
  feedbackTimers: () => number;
};

async function deferClipboardCompletion(page: Page) {
  await page.evaluate(() => {
    const pending: Array<() => void> = [];
    const nativeWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = async (value) => {
      await nativeWrite(value);
      await new Promise<void>((resolve) => pending.push(resolve));
    };
    const nativeTimeout = window.setTimeout.bind(window);
    let feedbackTimers = 0;
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === 1800) feedbackTimers += 1;
      return nativeTimeout(handler, timeout, ...args);
    }) as typeof window.setTimeout;
    Reflect.set(window, "mcpClipboardCompletion", {
      pendingCount: () => pending.length,
      release: async (index: number) => {
        pending[index]();
        // Let the clipboard promise chain and its UI update finish in this task.
        await new Promise<void>((resolve) => nativeTimeout(resolve, 0));
      },
      feedbackTimers: () => feedbackTimers,
    } satisfies ClipboardCompletionControl);
  });
}

async function releaseClipboardCompletion(page: Page, index: number) {
  await page.evaluate(
    (position) =>
      (
        Reflect.get(
          window,
          "mcpClipboardCompletion",
        ) as ClipboardCompletionControl
      ).release(position),
    index,
  );
}

async function pendingClipboardCompletions(page: Page) {
  return page.evaluate(() =>
    (
      Reflect.get(
        window,
        "mcpClipboardCompletion",
      ) as ClipboardCompletionControl
    ).pendingCount(),
  );
}

for (const locale of ["en-us", "zh-cn"]) {
  for (const repeat of ["same", "different"] as const) {
    test(
      `MCP copy feedback owns its latest timer ${locale} ${repeat}`,
      {
        tag: "@Site/Web",
      },
      async ({ page, publicFlow, isolatedWorker }, info) => {
        await page.clock.install();
        await publicFlow.run(async () => {
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
          await gotoAndWaitForReady(page, "/usage/mcp?client=other");
          const endpointButton = endpointCopyButton(page);
          const otherButton = page.locator(
            '[data-usage-marketing="hero"] button',
          );
          const copied = locale === "en-us" ? "Copied" : "已复制";
          const heroCopied =
            locale === "en-us" ? "Endpoint copied" : "端点已复制";
          const copy = async (
            button: Locator,
            sequence: string,
            expectedFeedback: string,
          ) => {
            await page.evaluate(
              (value) => navigator.clipboard.writeText(value),
              sequence,
            );
            await button.click();
            await expect
              .poll(() => page.evaluate(() => navigator.clipboard.readText()))
              .toContain(endpoint);
            await expect(button).toContainText(expectedFeedback);
          };
          await endpointButton.scrollIntoViewIfNeeded();
          await page.clock.pauseAt(
            await page.evaluate(() => Date.now() + 1000),
          );
          await copy(endpointButton, "first-copy", copied);
          await page.clock.runFor(900);
          const secondButton = repeat === "same" ? endpointButton : otherButton;
          const secondCopied = repeat === "same" ? copied : heroCopied;
          await copy(secondButton, "second-copy", secondCopied);
          await page.clock.runFor(900);
          await info.attach("feedback-at-previous-expiry", {
            body: await secondButton.screenshot(),
            contentType: "image/png",
          });
          await expect(secondButton).toContainText(secondCopied);
          if (repeat === "different")
            await expect(endpointButton).not.toContainText(copied);
          await page.clock.runFor(899);
          await expect(secondButton).toContainText(secondCopied);
          await page.clock.runFor(1);
          await expect(secondButton).not.toContainText(secondCopied);
          await page.clock.resume();
        });
      },
    );
  }
}

test("MCP copy feedback follows the latest attempt when clipboard completes out of order", {
  tag: "@Site/Web",
}, async ({ page, publicFlow, isolatedWorker }) => {
  await publicFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoAndWaitForReady(page, "/usage/mcp?client=other");
    await deferClipboardCompletion(page);
    const endpointButton = endpointCopyButton(page);
    const heroButton = page.locator('[data-usage-marketing="hero"] button');
    await endpointButton.click();
    await expect.poll(() => pendingClipboardCompletions(page)).toBe(1);
    await heroButton.click();
    await expect.poll(() => pendingClipboardCompletions(page)).toBe(2);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(endpoint);

    await releaseClipboardCompletion(page, 1);
    await expect(heroButton).toContainText("Endpoint copied");
    await expect(endpointButton).not.toContainText("Copied");
    await releaseClipboardCompletion(page, 0);
    await expect(heroButton).toContainText("Endpoint copied");
    await expect(endpointButton).not.toContainText("Copied");
    expect(
      await page.evaluate(() =>
        (
          Reflect.get(
            window,
            "mcpClipboardCompletion",
          ) as ClipboardCompletionControl
        ).feedbackTimers(),
      ),
    ).toBe(1);
  });
});

test("MCP clipboard completion after leaving the page does not schedule feedback", {
  tag: "@Site/Web",
}, async ({ page, publicFlow, isolatedWorker }) => {
  await publicFlow.run(async () => {
    await page
      .context()
      .addCookies([
        { name: "NEXT_LOCALE", value: "en-us", url: isolatedWorker.origin },
      ]);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await gotoAndWaitForReady(page, "/usage/mcp?client=other");
    await deferClipboardCompletion(page);
    await endpointCopyButton(page).click();
    await expect.poll(() => pendingClipboardCompletions(page)).toBe(1);
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(endpoint);

    // A real app link preserves this document while unmounting the MCP page.
    await page.locator('a[href="/usage/cli"]').first().click();
    await expect(page).toHaveURL(/\/usage\/cli$/);
    await expect(endpointCopyButton(page)).toHaveCount(0);
    await expect.poll(() => pendingClipboardCompletions(page)).toBe(1);
    await releaseClipboardCompletion(page, 0);
    expect(
      await page.evaluate(() =>
        (
          Reflect.get(
            window,
            "mcpClipboardCompletion",
          ) as ClipboardCompletionControl
        ).feedbackTimers(),
      ),
    ).toBe(0);
  });
});
