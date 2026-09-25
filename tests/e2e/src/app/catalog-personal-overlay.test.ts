import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../utils/auth";
import { DEV_SEED } from "../../utils/dev-seed";

const SECTION_URL = `/catalog/sections/${DEV_SEED.section.jwId}`;
const subscriptionLabel =
  /订阅教学班|Subscribe to section|取消订阅|Unsubscribe from section/i;

// These tests intentionally observe the unsettled public page before the
// private request finishes, so they do not use gotoAndWaitForReady.
test("section public content stays readable while personal actions await the viewer", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/workspace");
  let release!: () => void;
  let received!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route("**/_internal/catalog/sections/*/viewer*", async (route) => {
    const response = await route.fetch();
    expect(response.headers()["cache-control"]).toContain("no-store");
    received();
    await blocked;
    await route.fulfill({ response });
  });
  try {
    await page.goto(SECTION_URL, { waitUntil: "domcontentloaded" });
    await requested;
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: subscriptionLabel }),
    ).toHaveCount(0);
    await expect(page.locator('form[action="?/subscribe"]')).toHaveCount(0);
  } finally {
    release();
  }
  await expect(
    page.getByRole("button", { name: subscriptionLabel }).first(),
  ).toBeVisible();
});

test("section viewer failure disables personal actions and supports retry", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/_internal/catalog/sections/*/viewer*", async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(`${SECTION_URL}?subscribe=1`, {
    waitUntil: "domcontentloaded",
  });
  const error = page
    .getByRole("alert")
    .filter({ has: page.getByRole("button") })
    .first();
  await expect(error).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: subscriptionLabel }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await error.getByRole("button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: /登录|Sign in/i }),
  ).toBeVisible();
  expect(requests).toBe(2);
});

test("description editing awaits private permissions while preserving SSR content", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/workspace");
  let release!: () => void;
  let received!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    received = resolve;
  });
  await page.route("**/api/community/descriptions?**", async (route) => {
    const response = await route.fetch();
    expect(response.headers()["cache-control"]).toContain("no-store");
    received();
    await blocked;
    await route.fulfill({ response });
  });
  try {
    await page.goto(`/catalog/courses/${DEV_SEED.course.jwId}`, {
      waitUntil: "domcontentloaded",
    });
    await requested;
    await expect(
      page.locator("#introduction").getByRole("heading"),
    ).toBeVisible();
    await expect(page.getByTestId("description-edit")).toHaveCount(0);
    await expect(page.getByTestId("description-edit-login")).toHaveCount(0);
  } finally {
    release();
  }
  await expect(page.getByTestId("description-edit")).toBeVisible();
});

test("links keep public browsing usable when personal pins fail and recover on retry", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/workspace");
  let requests = 0;
  await page.route("**/_internal/catalog/links/viewer", async (route) => {
    requests += 1;
    if (requests === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("/catalog/links", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(
    page.locator('form[action="/api/workspace/link-pins"]'),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /重试|Retry/i }).click();
  await expect(
    page.locator('form[action="/api/workspace/link-pins"]').first(),
  ).toBeAttached();
  expect(requests).toBe(2);
});

test("bus preference read failures cannot save anonymous defaults over the account", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/workspace");
  let reads = 0;
  let writes = 0;
  await page.route("**/api/workspace/bus-preferences", async (route) => {
    if (route.request().method() !== "GET") {
      writes += 1;
      await route.continue();
      return;
    }
    reads += 1;
    if (reads === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "unavailable" }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto("/catalog/bus", { waitUntil: "domcontentloaded" });
  const planner = page.getByTestId("bus-responsive-planner");
  await expect(planner).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  const publicControl = planner
    .getByRole("button")
    .filter({ visible: true })
    .first();
  await expect(publicControl).toBeEnabled();
  await publicControl.click();
  expect(writes).toBe(0);
  const loaded = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/workspace/bus-preferences") &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: /重试|Retry|重新加载/i }).click();
  await loaded;
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(planner).toBeVisible();
  expect(reads).toBe(2);
  expect(writes).toBe(0);
});
