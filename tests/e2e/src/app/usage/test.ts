import { expect, test } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { captureStepScreenshot } from "../../../utils/screenshot";
import { assertPageContract } from "../_shared/page-contract";

for (const routePath of [
  "/usage/mobile",
  "/usage/bot",
  "/usage/mcp",
  "/usage/cli",
]) {
  test(`${routePath} page contract`, async ({ page }, testInfo) => {
    await assertPageContract(page, { routePath, testInfo });
  });
}

test("usage pages expose their primary handoff", async ({ page }, testInfo) => {
  await gotoAndWaitForReady(page, "/usage/mobile", {
    testInfo,
    screenshotLabel: "usage-mobile",
  });
  await expect(
    page.getByRole("link", { name: /App Store|下载/i }),
  ).toBeVisible();
  await expect(
    page.locator('img[src="/images/mobile-app/screenshot-01.png"]').first(),
  ).toBeVisible();

  await gotoAndWaitForReady(page, "/usage/bot", { testInfo });
  await expect(
    page.getByRole("link", { name: /联系 Presto|Message Presto/i }),
  ).toHaveAttribute("href", "https://qm.qq.com/q/eOL0WhizeM");
  const prestoQrCode = page.getByRole("img", {
    name: /Presto QQ (?:二维码|QR code)/i,
  });
  await expect(prestoQrCode).toBeHidden();
  const qrTrigger = page.getByRole("button", {
    name: /Presto QQ (?:二维码|QR code)/i,
  });
  await expect(qrTrigger).toBeVisible();
  await qrTrigger.focus();
  await qrTrigger.press("Enter");
  await expect(prestoQrCode).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(prestoQrCode).toBeHidden();
  await qrTrigger.press("Space");
  await expect(prestoQrCode).toBeVisible();
  await page.getByRole("heading", { name: /Presto/i, level: 1 }).click();
  await expect(prestoQrCode).toBeHidden();
  await expect(
    page.getByRole("link", { name: /Bot 源码|Bot source/i }),
  ).toHaveCount(0);
  await expect(page.getByText("/life", { exact: false })).toHaveCount(0);
  await expect(
    page.getByRole("img", {
      name: /Presto 返回的下一节课图片|Upcoming class image returned by Presto/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /Presto 返回的本周课表图片|Weekly schedule image returned by Presto/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /Presto 返回的校车班次图片|Shuttle bus image returned by Presto/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: /Presto 返回的作业图片|Homework image returned by Presto/i,
    }),
  ).toBeVisible();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoAndWaitForReady(page, "/usage/mcp", { testInfo });
  await expect(
    page
      .getByRole("button", { name: /复制 MCP 端点|Copy MCP endpoint/i })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: /启用开发者模式|Enable Developer Mode/i,
    }),
  ).toHaveAttribute(
    "href",
    "https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta",
  );
  await expect(
    page.getByRole("link", {
      name: /下载 ChatGPT 插件图标|Download the ChatGPT plugin icon/i,
    }),
  ).toHaveAttribute("download", "life-ustc-chatgpt-icon.png");
  await expect(
    page.locator('img[src="/images/usage/mcp-use-case.png"]').first(),
  ).toBeVisible();
  await expect(
    page
      .locator(
        'img[src="/images/usage/mcp-chatgpt-filled-zh.png"], img[src="/images/usage/mcp-chatgpt-filled-en.png"]',
      )
      .last(),
  ).toBeVisible();
  await expect(
    page
      .locator(
        'img[src="/images/usage/mcp-chatgpt-overview-zh.png"], img[src="/images/usage/mcp-chatgpt-overview-en.png"]',
      )
      .last(),
  ).toBeVisible();
  await expect(page.getByText(/截图语言|Screenshot language/i)).toHaveCount(0);
  const chatgptNameValue = page.getByRole("button", {
    name: /(?:名称|Name).*Life @ USTC/i,
  });
  await chatgptNameValue.click();
  await expect(chatgptNameValue).toContainText(/已复制|Copied/i);
  await expect(
    page.getByRole("button", {
      name: /(?:描述|Description).*Modern, unified MCP entrypoint of USTC/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /(?:连接|Connection).*Server URL/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /(?:身份验证|Authentication).*OAuth/i }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/完成 Life@USTC 授权|Authorize with Life@USTC/i),
  ).toBeVisible();

  const clientTabs = page.getByRole("tab");
  await expect(clientTabs).toHaveCount(3);
  await expect(clientTabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await clientTabs.nth(0).focus();
  await clientTabs.nth(0).press("ArrowRight");
  await expect(clientTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel").filter({
      has: page.locator('img[src="/images/usage/mcp-claude-filled.png"]'),
    }),
  ).toBeVisible();

  await page.getByRole("tab", { name: /Claude\.ai/i }).click();
  await expect(
    page.locator('img[src="/images/usage/mcp-claude-filled.png"]').last(),
  ).toBeVisible();
  const claudeUrlValue = page.getByRole("button", {
    name: /(?:服务器 URL|Server URL).*https:\/\/life-ustc\.tiankaima\.dev\/api\/mcp/i,
  });
  await claudeUrlValue.click();
  await expect(claudeUrlValue).toContainText(/已复制|Copied/i);

  await page.getByRole("tab", { name: /其他客户端|Other agents/i }).click();
  await expect(
    page
      .getByText("https://life-ustc.tiankaima.dev/api/mcp", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Codex.*Claude Code/i }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "codex mcp add life-ustc --url https://life-ustc.tiankaima.dev/api/mcp",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "claude mcp add --scope user --transport http life-ustc https://life-ustc.tiankaima.dev/api/mcp",
      { exact: true },
    ),
  ).toBeVisible();

  await gotoAndWaitForReady(page, "/usage/cli", { testInfo });
  await expect(
    page.getByRole("link", { name: /在 GitHub 查看|View on GitHub/i }),
  ).toHaveAttribute("href", "https://github.com/Life-USTC/CLI");
  await expect(
    page.getByText(
      /go install github\.com\/Life-USTC\/CLI\/cmd\/life-ustc@latest/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Showing 3 of 6 · page 1 of 2/).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/MATH1004.*线性代数\(A1\)/).first(),
  ).toBeVisible();
  await expect(page.getByText(/07:30 → 07:40/).first()).toBeVisible();

  await captureStepScreenshot(page, testInfo, "usage-cli");
});
