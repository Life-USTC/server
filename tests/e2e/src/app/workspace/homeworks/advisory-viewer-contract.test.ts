import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, type Page, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { PLAYWRIGHT_BASE_URL } from "../../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { cleanupHomeworksForE2e } from "../../../../utils/homeworks";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../../utils/workspace-task-filters";
import { issueAccessToken, parseTextContent } from "../../api/mcp/helpers";
import { selectHomeworkAction } from "../../sections/[jwId]/_helpers";

let ownerId: string;
let sectionId: number;
let sectionJwId: number;
let oauthClientId: string | undefined;
const description = "Just do the exercises. Submit however you prefer.";

test.beforeEach(async ({ page }) => {
  oauthClientId = undefined;
  const marker = `homework-advisory-${crypto.randomUUID().slice(0, 8)}`;
  const fixture = await withE2ePrisma(async (db) => {
    const seed = await db.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
    });
    const owner = await db.user.create({
      data: {
        name: marker,
        username: marker,
        email: `${marker}@example.test`,
        emailVerified: true,
      },
    });
    const section = await db.section.create({
      data: {
        code: marker,
        jwId: 1_600_000_000 + Math.floor(Math.random() * 100_000_000),
        courseId: seed.courseId,
        semesterId: seed.semesterId,
      },
    });
    await db.userSectionSubscription.create({
      data: { sectionId: section.id, userId: owner.id },
    });
    return { owner, section };
  });
  ownerId = fixture.owner.id;
  sectionId = fixture.section.id;
  sectionJwId = fixture.section.jwId;
  await page.context().clearCookies();
  await page.context().addCookies([await createSignedSessionCookie(ownerId)]);
});

test.afterEach(async () => {
  const homeworks = await withE2ePrisma((db) =>
    db.homework.findMany({ where: { sectionId }, select: { id: true } }),
  );
  await cleanupHomeworksForE2e(homeworks.map(({ id }) => id));
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({ where: { userId: ownerId } });
    if (oauthClientId)
      await db.oAuthClient.delete({ where: { clientId: oauthClientId } });
    await db.userSectionSubscription.deleteMany({ where: { userId: ownerId } });
    await db.section.delete({ where: { id: sectionId } });
    await db.user.delete({ where: { id: ownerId } });
  });
});

async function stored(title: string) {
  const result = await withE2ePrisma((db) =>
    db.homework.findFirstOrThrow({
      where: { sectionId, title },
      include: { description: true },
    }),
  );
  expect(result.description?.content).toBe(description);
  expect(result.createdById).toBe(ownerId);
  return result;
}

async function setLocale(page: Page, locale: string) {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
  });
  expect(response.status()).toBe(200);
  await page
    .context()
    .addCookies([
      { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
    ]);
}

test("homework.homework-style-guide-advisory", async ({ page, request }) => {
  test.setTimeout(120_000);
  await setLocale(page, "en-us");
  const sectionUrl = `/catalog/sections/${sectionJwId}#homework`;
  const title = (surface: string) =>
    `${DEV_SEED.course.nameCn} ${DEV_SEED.course.code} 第一章作业 ${surface}`;

  await gotoAndWaitForReady(page, sectionUrl);
  await page
    .getByRole("button", { name: /新建|创建作业|Create/i })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.locator('input[name="title"]').fill(title("section-create"));
  await dialog
    .getByRole("textbox", { name: "Details", exact: true })
    .fill(description);
  await dialog
    .getByRole("button", { name: /创建作业|Create homework/i })
    .click();
  await expect(dialog).toBeHidden();
  const sectionCreated = await stored(title("section-create"));
  await page
    .getByRole("button", { name: title("section-create"), exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await selectHomeworkAction(page, dialog, /编辑信息|Edit details/i);
  await dialog.locator('input[name="title"]').fill(title("section-edit"));
  await dialog.getByRole("button", { name: /保存修改|Save changes/i }).click();
  await expect(async () => {
    expect((await stored(title("section-edit"))).id).toBe(sectionCreated.id);
  }).toPass();
  await page.keyboard.press("Escape");

  await gotoAndWaitForReady(page, "/workspace/homeworks");
  await page.getByTestId("workspace-homeworks-add").first().click();
  dialog = page.getByRole("dialog");
  await dialog
    .locator('select[name="sectionId"]')
    .selectOption(String(sectionId));
  await dialog.getByTestId("workspace-homework-title").fill(title("workspace"));
  await dialog
    .getByRole("textbox", { name: "Details", exact: true })
    .fill(description);
  await dialog.getByTestId("workspace-homework-create").click();
  await expect(dialog).toBeHidden();
  await stored(title("workspace"));

  const restCreate = await page.request.post(
    "/api/community/section-homeworks",
    {
      data: { sectionJwId, title: title("rest-create"), description },
    },
  );
  expect(restCreate.status()).toBe(201);
  const restId = (await restCreate.json()).id;
  await stored(title("rest-create"));
  const restUpdate = await page.request.patch(
    `/api/community/section-homeworks/${restId}`,
    {
      data: { title: title("rest-edit"), description },
    },
  );
  expect(restUpdate.status()).toBe(200);
  expect((await stored(title("rest-edit"))).id).toBe(restId);

  const gqlCreate = await page.request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL },
    data: {
      query:
        "mutation($input: CreateHomeworkInput!) { homeworkCreate(input: $input) { id } }",
      variables: {
        input: { sectionJwId, title: title("graphql-create"), description },
      },
    },
  });
  const created = await gqlCreate.json();
  expect(created.errors).toBeUndefined();
  const gqlId = created.data.homeworkCreate.id;
  await stored(title("graphql-create"));
  const gqlUpdate = await page.request.post("/api/graphql", {
    headers: { origin: PLAYWRIGHT_BASE_URL },
    data: {
      query:
        "mutation($id: ID!, $input: UpdateHomeworkInput!) { homeworkUpdate(id: $id, input: $input) { id } }",
      variables: {
        id: gqlId,
        input: { title: title("graphql-edit"), description },
      },
    },
  });
  expect((await gqlUpdate.json()).errors).toBeUndefined();
  expect((await stored(title("graphql-edit"))).id).toBe(gqlId);

  const scope = "community.section-homework:write";
  const resource = `${PLAYWRIGHT_BASE_URL}/api/mcp`;
  const token = await issueAccessToken(page, request, {
    scope,
    clientScopes: [scope],
    resource,
  });
  oauthClientId = token.clientId;
  const client = new Client({ name: "homework-advisory", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(resource), {
    requestInit: { headers: { Authorization: `Bearer ${token.accessToken}` } },
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "community_section_homework_create",
      arguments: { sectionJwId, title: title("mcp-create"), description },
    });
    expect(result.isError).not.toBe(true);
    const mcpId = parseTextContent(result).id;
    expect((await stored(title("mcp-create"))).id).toBe(mcpId);
    const updated = await client.callTool({
      name: "community_section_homework_update",
      arguments: { homeworkId: mcpId, title: title("mcp-edit"), description },
    });
    expect(updated.isError).not.toBe(true);
    expect((await stored(title("mcp-edit"))).id).toBe(mcpId);
  } finally {
    await client.close();
  }
});

test("homework.teaching-assistant-label", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const title = `TA homework ${crypto.randomUUID()}`;
  await withE2ePrisma(async (db) => {
    await db.userSectionSubscription.updateMany({
      where: { sectionId, userId: ownerId },
      data: { kind: "teaching_assistant" },
    });
    await db.homework.create({
      data: {
        sectionId,
        title,
        createdById: ownerId,
        submissionDueAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
  });
  for (const locale of ["zh-cn", "en-us"]) {
    await setLocale(page, locale);
    const label = locale === "zh-cn" ? "无需完成" : "No completion required";
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const path of [
        "/workspace/homeworks",
        `/catalog/sections/${sectionJwId}#homework`,
      ]) {
        await gotoAndWaitForReady(page, path);
        if (path === "/workspace/homeworks")
          await page.getByRole("radio", { name: /^(全部|All)$/ }).click();
        const button = page.getByRole("button", { name: title, exact: true });
        const item = button.locator(
          'xpath=ancestor::*[self::tr or @data-slot="item"][1]',
        );
        await expect(item.getByText(label, { exact: true })).toBeVisible();
        await expect(
          item.getByRole("button", { name: /标记为完成|Mark as complete/i }),
        ).toHaveCount(0);
        await button.click();
        const detail = page.getByRole("dialog", { name: title, exact: true });
        await expect(
          detail.getByTestId("homework-secondary-details"),
        ).toContainText(label);
        await expect(
          detail.getByRole("button", { name: /标记为完成|Mark as complete/i }),
        ).toHaveCount(0);
        await page.keyboard.press("Escape");
      }
    }
    const anonymous = await browser.newContext({
      baseURL: PLAYWRIGHT_BASE_URL,
    });
    try {
      await anonymous.addCookies([
        { name: "NEXT_LOCALE", value: locale, url: PLAYWRIGHT_BASE_URL },
      ]);
      const publicPage = await anonymous.newPage();
      await gotoAndWaitForReady(
        publicPage,
        `/catalog/sections/${sectionJwId}#homework`,
      );
      await publicPage
        .getByRole("button", { name: title, exact: true })
        .click();
      const detail = publicPage.getByRole("dialog", {
        name: title,
        exact: true,
      });
      await expect(detail).toBeVisible();
      await expect(detail).not.toContainText(label);
      const response = await anonymous.request.get(
        `/api/community/section-homeworks?sectionJwId=${sectionJwId}`,
      );
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        title,
        completionRequired: true,
        completion: null,
      });
      expect(JSON.stringify(body)).not.toContain("teaching_assistant");
    } finally {
      await anonymous.close();
    }
  }
});
