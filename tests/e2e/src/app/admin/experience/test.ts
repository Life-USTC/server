import { expect, test, type Page } from "@playwright/test";
import { stringify, unflatten } from "devalue";
import { signInAsDevAdmin } from "../../../../utils/auth";

type ExperienceDataPatch = {
  errorSamples: readonly Record<string, unknown>[];
  errorsStatus: Record<string, unknown>;
  errorsTruncated: boolean;
  rows: readonly Record<string, unknown>[];
  showErrors: boolean;
  status: Record<string, unknown>;
};

const readyRow = {
  authMode: "session",
  errorCount: 0,
  feature: "catalog.search",
  operation: "view",
  outcome: "success",
  p50WallMs: 12.5,
  p95WallMs: 42,
  protocol: "web",
  rejectedCount: 0,
  surface: "web",
  total: 4,
  unknownCount: 0,
};

const issueSample = {
  authMode: "unknown",
  errorClass: "unknown",
  feature: "catalog.search",
  occurredAt: "2026-09-14T01:23:45.000Z",
  operation: "view",
  outcome: "unknown",
  protocol: "mcp",
  requestId: "req_e2e_issue",
  surface: "unknown",
};

function readyData(
  overrides: Partial<ExperienceDataPatch> = {},
): ExperienceDataPatch {
  return {
    errorSamples: [],
    errorsStatus: { state: "empty" },
    errorsTruncated: false,
    rows: [readyRow],
    showErrors: false,
    status: { state: "ready" },
    ...overrides,
  };
}

async function installExperienceFixture(
  page: Page,
  fixture:
    | ExperienceDataPatch
    | ((requestUrl: URL) => ExperienceDataPatch),
) {
  await page.route("**/admin/experience/__data.json*", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const requestUrl = new URL(route.request().url());
    const patch = typeof fixture === "function" ? fixture(requestUrl) : fixture;
    let replaced = false;

    for (const node of payload.nodes ?? []) {
      if (node?.type !== "data" || !Array.isArray(node.data)) continue;
      const data = unflatten(node.data) as Record<string, unknown>;
      if (!("rows" in data) || !("status" in data)) continue;
      node.data = JSON.parse(stringify({ ...data, ...patch }));
      replaced = true;
    }

    expect(replaced).toBe(true);
    await route.fulfill({ response, json: payload });
  });
}

async function openExperiencePage(
  page: Page,
  fixture:
    | ExperienceDataPatch
    | ((requestUrl: URL) => ExperienceDataPatch),
) {
  await signInAsDevAdmin(page, "/admin/analytics");
  await installExperienceFixture(page, fixture);
  await page
    .getByRole("link", { name: /查看功能体验|Open feature experience/i })
    .click();
  await expect(page).toHaveURL(/\/admin\/experience(?:\?.*)?$/);
  await expect(
    page.getByRole("heading", { name: /功能体验|Feature Experience/i }),
  ).toBeVisible();
}

test("7/30 天切换保留功能、协议和近期问题参数", async ({ page }) => {
  await openExperiencePage(
    page,
    (requestUrl) =>
      readyData({
        showErrors: requestUrl.searchParams.get("errors") === "1",
        errorSamples:
          requestUrl.searchParams.get("errors") === "1" ? [issueSample] : [],
        errorsStatus:
          requestUrl.searchParams.get("errors") === "1"
            ? { state: "ready" }
            : { state: "empty" },
      }),
  );

  await page
    .getByLabel(/功能|Feature/)
    .selectOption("catalog.search");
  await page.getByLabel(/协议|Protocol/).selectOption("rest");
  await page.getByRole("button", { name: /应用筛选|Apply filters/i }).click();
  await expect(page).toHaveURL(/feature=catalog.search/);

  await page
    .getByRole("link", { name: /查看近期问题|Show recent issues/i })
    .click();
  await expect(page).toHaveURL(/errors=1/);

  for (const days of [7, 30]) {
    await page
      .getByRole("link", {
        name: new RegExp(
          days === 7
            ? "最近 7 .*完整|Last 7 full days"
            : "最近 30 .*完整|Last 30 full days",
          "i",
        ),
      })
      .click();
    const url = new URL(page.url());
    expect(url.searchParams.get("days")).toBe(String(days));
    expect(url.searchParams.get("feature")).toBe("catalog.search");
    expect(url.searchParams.get("protocol")).toBe("rest");
    expect(url.searchParams.get("errors")).toBe("1");
  }
});

test("GET 筛选提交并可清除", async ({ page }) => {
  await openExperiencePage(page, readyData());

  await page.getByLabel(/功能|Feature/).selectOption("workspace.homework");
  await page.getByLabel(/操作|Operation/).fill("list");
  await page.getByLabel(/协议|Protocol/).selectOption("mcp");
  await page.getByRole("button", { name: /应用筛选|Apply filters/i }).click();

  let url = new URL(page.url());
  expect(url.pathname).toBe("/admin/experience");
  expect(url.searchParams.get("days")).toBe("30");
  expect(url.searchParams.get("feature")).toBe("workspace.homework");
  expect(url.searchParams.get("operation")).toBe("list");
  expect(url.searchParams.get("protocol")).toBe("mcp");

  await page.getByRole("link", { name: /清除|Clear/i }).click();
  url = new URL(page.url());
  expect(url.pathname).toBe("/admin/experience");
  expect(url.search).toBe("");
});

test("区分尚未观测与遥测不可用", async ({ page }) => {
  await openExperiencePage(
    page,
    readyData({ rows: [], status: { state: "empty" } }),
  );
  await expect(
    page.getByRole("heading", { name: /尚未观测到|Not yet observed/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/不能据此判断使用量为零|does not establish zero usage/i),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await openExperiencePage(
    page,
    readyData({
      rows: [],
      status: { reason: "not_configured", state: "unavailable" },
    }),
  );
  await expect(
    page.getByRole("alert").filter({
      hasText: /使用遥测不可用|Usage telemetry unavailable/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /尚未观测到|Not yet observed/i }),
  ).toHaveCount(0);
});

test("显示近期问题样本及截断提示", async ({ page }) => {
  await openExperiencePage(
    page,
    readyData({
      errorSamples: Array.from({ length: 20 }, () => issueSample),
      errorsStatus: { state: "ready" },
      errorsTruncated: true,
      showErrors: true,
    }),
  );

  await expect(
    page.getByRole("heading", { name: /近期问题样本|Recent issue samples/i }),
  ).toBeVisible();
  await expect(page.getByText("req_e2e_issue", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/未知|Unknown/i).first()).toBeVisible();
  await expect(
    page.getByText(
      /这里只显示最新的 20 条问题样本|Only the 20 latest sampled issues are shown/i,
    ),
  ).toBeVisible();
});
