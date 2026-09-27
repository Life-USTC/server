import { expect, type Page, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function fixture(page: Page, complete = false) {
  const username = `welcome${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        email: `${username}@example.test`,
        name: complete ? "Welcome contract" : "",
        username: complete ? username : null,
      },
    }),
  );
  await page.context().addCookies([await createSignedSessionCookie(user.id)]);
  return {
    user,
    username,
    cleanup: () =>
      withE2ePrisma((db) => db.user.delete({ where: { id: user.id } })),
  };
}
const nameInput = (page: Page) =>
  page.getByRole("textbox", { name: /^(昵称|Nickname)(?:\s|$)/i });
const usernameInput = (page: Page) =>
  page.getByRole("textbox", { name: /^ID\b/i });
const skip = (page: Page) =>
  page.getByRole("link", { name: /暂时跳过|Skip for now/i });
const finish = (page: Page) =>
  page.getByRole("link", { name: /进入工作区|Go to workspace/i });

test("user.profile-field-labels", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  const f = await fixture(page);
  try {
    for (const [locale, nickname] of [
      ["zh-cn", "昵称"],
      ["en-us", "Nickname"],
    ]) {
      await page
        .context()
        .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
      for (const complete of [false, true]) {
        await withE2ePrisma((db) =>
          db.user.update({
            where: { id: f.user.id },
            data: {
              name: complete ? "Chosen nickname" : "",
              username: complete ? f.username : null,
            },
          }),
        );
        await gotoAndWaitForReady(
          page,
          complete ? "/account/settings/profile" : "/account/welcome",
        );
        const nicknameField = page.getByRole("textbox", {
          name: new RegExp(`^${nickname}\\s*\\*$`),
        });
        const idField = page.getByRole("textbox", {
          name: complete ? /^ID$/ : /^ID\s*\*$/,
        });
        await expect(nicknameField).toBeVisible();
        await expect(nicknameField).toHaveAttribute("name", "name");
        await expect(nicknameField).toHaveAttribute("autocomplete", "nickname");
        await expect(nicknameField).toHaveValue(
          complete ? "Chosen nickname" : "",
        );
        await expect(idField).toBeVisible();
        await expect(idField).toHaveAttribute("name", "username");
        await expect(idField).toHaveValue(complete ? f.username : "");
      }
    }
  } finally {
    await f.cleanup();
  }
});

async function expectStep(page: Page, step: 1 | 2 | 3) {
  await expect(
    page.getByText(new RegExp(`第 ${step} 步|Step ${step} of`, "i")),
  ).toBeVisible();
  await expect(nameInput(page)).toHaveCount(step === 1 ? 1 : 0);
  await expect(skip(page)).toHaveCount(step === 2 ? 1 : 0);
  await expect(finish(page)).toHaveCount(step === 3 ? 1 : 0);
}

test("user.welcome-flow-required", async ({ page }) => {
  await gotoAndWaitForReady(page, "/account/welcome", {
    expectMainContent: false,
  });
  await expect(page).toHaveURL(/\/account\/sign-in\?/);
  const f = await fixture(page);
  try {
    for (const profile of [
      { name: "", username: "" },
      { name: "Existing name", username: "" },
      { name: "", username: f.username },
    ]) {
      await withE2ePrisma((db) =>
        db.user.update({ where: { id: f.user.id }, data: profile }),
      );
      for (const path of [
        "/account/settings/profile",
        "/account/welcome?step=subscriptions",
        "/account/welcome?step=finish",
      ]) {
        await gotoAndWaitForReady(page, path, { expectMainContent: false });
        await expect(page).toHaveURL(/\/account\/welcome/);
        await expectStep(page, 1);
        await expect(usernameInput(page)).toBeVisible();
      }
    }
  } finally {
    await f.cleanup();
  }
});

test("user.welcome-staged-steps", async ({ page }) => {
  const f = await fixture(page);
  try {
    const callback = "/account/settings/profile?welcome=done";
    await gotoAndWaitForReady(
      page,
      `/account/welcome?callbackUrl=${encodeURIComponent(callback)}`,
    );
    await expectStep(page, 1);
    await nameInput(page).fill("Welcome contract");
    await usernameInput(page).fill(f.username);
    await page.getByRole("button", { name: /继续|Continue/i }).click();
    await expect(page).toHaveURL(/step=subscriptions/);
    await expectStep(page, 2);
    expect(
      await withE2ePrisma((db) =>
        db.user.findUniqueOrThrow({ where: { id: f.user.id } }),
      ),
    ).toMatchObject({ name: "Welcome contract", username: f.username });
    await skip(page).click();
    await expect(page).toHaveURL(/step=finish/);
    await expectStep(page, 3);
    await page.getByRole("link", { name: /上一步|Back/i }).click();
    await expect(page).toHaveURL(/step=subscriptions/);
    await expectStep(page, 2);
    await gotoAndWaitForReady(
      page,
      `/account/welcome?step=profile&callbackUrl=${encodeURIComponent(callback)}`,
    );
    await expect(page).toHaveURL(
      new RegExp(`${callback.replace("?", "\\?")}$`),
    );
  } finally {
    await f.cleanup();
  }
});

test("user.welcome-shell-isolation", async ({ page }) => {
  const f = await fixture(page);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [index, step] of [
        "profile",
        "subscriptions",
        "finish",
      ].entries()) {
        await withE2ePrisma((db) =>
          db.user.update({
            where: { id: f.user.id },
            data: {
              name: index ? "Welcome contract" : "",
              username: index ? f.username : null,
            },
          }),
        );
        await gotoAndWaitForReady(page, `/account/welcome?step=${step}`);
        await expectStep(page, (index + 1) as 1 | 2 | 3);
        await expect(page.getByTestId("app-sidebar")).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /打开搜索|Open search/i }),
        ).toHaveCount(0);
        await expect(
          page.locator('[data-shell-navigation="mobile-primary"]'),
        ).toHaveCount(0);
      }
    }
  } finally {
    await f.cleanup();
  }
});

test("user.welcome-completion-resume", async ({ page }) => {
  const f = await fixture(page, true);
  try {
    const target = "/account/settings/profile?from=welcome#profile";
    for (const callback of [
      target,
      undefined,
      "https://attacker.example/",
      "//attacker.example/",
      "/\\attacker.example/",
      "/%2f%2fattacker.example/",
      "/account/welcome?step=finish",
    ]) {
      await gotoAndWaitForReady(
        page,
        `/account/welcome?step=finish${callback === undefined ? "" : `&callbackUrl=${encodeURIComponent(callback)}`}`,
      );
      await expectStep(page, 3);
      await expect(finish(page)).toHaveAttribute(
        "href",
        callback === target ? target : "/",
      );
      await finish(page).click();
      await expect(page).toHaveURL(
        callback === target
          ? /\/account\/settings\/profile\?from=welcome#profile$/
          : /\/workspace\/overview$/,
      );
    }
  } finally {
    await f.cleanup();
  }
});
