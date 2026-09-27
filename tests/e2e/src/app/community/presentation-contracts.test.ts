import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../utils/auth";
import { DEV_SEED } from "../../../utils/dev-seed";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { waitForUiSettled } from "../../../utils/page-ready";

const marker = crypto.randomUUID();
const content = `Supplement-${marker}`;
const discussion = `Discussion-${marker}`;
const targets: {
  type: "course" | "section" | "teacher";
  id: number;
  path: string;
}[] = [];
let courseId: number;
let teacherId: number;
test.beforeAll(async () => {
  await withE2ePrisma(async (db) => {
    const editor = await db.user.findFirstOrThrow({
      where: { username: DEV_SEED.debugUsername },
    });
    const semester = await db.semester.findFirstOrThrow();
    const jwId = 1_800_000_000 + Math.floor(Math.random() * 100000000);
    const course = await db.course.create({
      data: { jwId, code: marker, nameCn: `Course-${marker}` },
    });
    courseId = course.id;
    const teacher = await db.teacher.create({
      data: { jwId: -jwId, nameCn: `Teacher-${marker}` },
    });
    teacherId = teacher.id;
    const section = await db.section.create({
      data: {
        courseId,
        semesterId: semester.id,
        jwId,
        code: marker,
        teachers: { connect: { id: teacherId } },
      },
    });
    targets.push(
      { type: "course", id: courseId, path: `/catalog/courses/${jwId}` },
      { type: "section", id: section.id, path: `/catalog/sections/${jwId}` },
      {
        type: "teacher",
        id: teacherId,
        path: `/catalog/teachers/${teacherId}`,
      },
    );
    for (const target of targets) {
      const relation = { [`${target.type}Id`]: target.id };
      const description = await db.description.create({
        data: {
          ...relation,
          content: `**${content}**`,
          lastEditedById: editor.id,
          lastEditedAt: new Date("2026-09-20T08:00:00Z"),
        },
      });
      await db.descriptionEdit.create({
        data: {
          descriptionId: description.id,
          editorId: editor.id,
          previousContent: "Before supplement",
          nextContent: `**${content}**`,
        },
      });
      await db.comment.create({
        data: { ...relation, userId: editor.id, body: `**${discussion}**` },
      });
    }
  });
});
test.afterAll(async () => {
  await withE2ePrisma(async (db) => {
    await db.section.deleteMany({ where: { courseId } });
    await db.course.deleteMany({ where: { id: courseId } });
    await db.teacher.deleteMany({ where: { id: teacherId } });
  });
});

test("description.public-web-personal-overlay", async ({
  browser,
  page,
  baseURL,
}) => {
  const anonymous = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
  });
  try {
    const staticPage = await anonymous.newPage();
    for (const target of targets) {
      const response = await staticPage.goto(target.path);
      expect(response?.status()).toBe(200);
      await expect(staticPage.locator("#introduction")).toContainText(content);
      const jsonLd = await staticPage
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(jsonLd.length).toBeGreaterThan(0);
      for (const raw of jsonLd) expect(JSON.parse(raw)).toBeTruthy();
      const payload = await anonymous.request.get(
        `/api/community/descriptions?targetType=${target.type}&targetId=${target.id}`,
        { maxRetries: 1 },
      );
      expect(payload.status()).toBe(200);
      expect((await payload.json()).viewer).toMatchObject({
        isAuthenticated: false,
        isAdmin: false,
      });
    }
  } finally {
    await anonymous.close();
  }
  await signInAsDebugUser(page);
  const failed = new Set<string>();
  const resolved = new Set<string>();
  await page.route("**/api/community/descriptions?**", async (route) => {
    const url = new URL(route.request().url());
    const key = `${url.searchParams.get("targetType")}:${url.searchParams.get("targetId")}`;
    if (!failed.has(key)) {
      failed.add(key);
      await route.fulfill({
        status: 503,
        json: { error: "Controlled permission-read failure" },
      });
      return;
    }
    const response = await route.fetch();
    const payload = await response.json();
    expect(payload.viewer.isAuthenticated).toBe(true);
    resolved.add(key);
    await route.fulfill({ response, json: payload });
  });
  for (const target of targets) {
    await page.goto(`${target.path}#introduction`);
    const introduction = page.locator("#introduction");
    const retry = introduction.getByRole("button", { name: /重试|Retry/i });
    await expect(retry).toBeVisible();
    await expect(introduction.getByTestId("description-edit")).toHaveCount(0);
    await expect(introduction).toContainText(content);
    await retry.click();
    await expect(introduction.getByTestId("description-edit")).toBeVisible();
    expect(resolved.has(`${target.type}:${target.id}`)).toBe(true);
  }
});

test("description.supplement-not-comment", async ({ page }) => {
  for (const target of targets) {
    await page.goto(target.path);
    await waitForUiSettled(page);
    const introduction = page.locator("#introduction");
    const comments = page.locator("#comments");
    await expect(introduction).toContainText(content);
    await expect(introduction).toContainText(DEV_SEED.debugName);
    await expect(introduction).toContainText("2026");
    await expect(introduction).not.toContainText(discussion);
    await expect(comments).toContainText(discussion);
    await expect(comments).not.toContainText(content);
  }
});

test("description.platform-maintained", async ({ page }) => {
  await signInAsDebugUser(page);
  await page.goto(`${targets[2].path}#introduction`);
  const introduction = page.locator("#introduction");
  await expect(introduction.getByTestId("description-edit")).toBeVisible();
  await expect(introduction).toContainText(DEV_SEED.debugName);
  await expect(introduction).not.toContainText(
    /大学认证|官方认证|University.verified|University.approved/i,
  );
  await introduction.getByRole("tab", { name: /历史|History/i }).click();
  await expect(introduction).toContainText("Before supplement");
  await expect(introduction).toContainText(content);
  await expect(introduction).toContainText(DEV_SEED.debugName);
});

test("description.web-markdown-hydration", async ({ page }) => {
  await signInAsDebugUser(page);
  await page.route("**/api/community/descriptions?**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.description.renderedHtml =
      '<strong data-testid="server-description-html">Server-rendered supplement</strong>';
    payload.description.content =
      "CLIENT_RENDERER_MUST_NOT_REPLACE_SERVER_HTML";
    await route.fulfill({ response, json: payload });
  });
  await page.goto(`${targets[2].path}#introduction`);
  await expect(page.getByTestId("server-description-html")).toHaveText(
    "Server-rendered supplement",
  );
  await expect(page.locator("#introduction")).not.toContainText(
    "CLIENT_RENDERER_MUST_NOT_REPLACE_SERVER_HTML",
  );
  await page.getByRole("tab", { name: /历史|History/i }).click();
  await page.locator("#introduction").getByRole("tab").first().click();
  await expect(page.getByTestId("server-description-html")).toBeVisible();
});

test("comment.web-markdown-hydration", async ({ page }) => {
  await page.route("**/api/community/comments?**", async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    expect(payload.data.length).toBeGreaterThan(0);
    payload.data[0].renderedBody =
      '<strong data-testid="server-comment-html">Server-rendered discussion</strong>';
    payload.data[0].body = "CLIENT_RENDERER_MUST_NOT_REPLACE_COMMENT_HTML";
    await route.fulfill({ response, json: payload });
  });
  await page.goto(`${targets[2].path}#comments`);
  await waitForUiSettled(page);
  await expect(page.getByTestId("server-comment-html")).toHaveText(
    "Server-rendered discussion",
  );
  await expect(page.locator("#comments")).not.toContainText(
    "CLIENT_RENDERER_MUST_NOT_REPLACE_COMMENT_HTML",
  );
});
