import { expect, type Page } from "@playwright/test";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { test } from "../../../utils/onboarding-fixture";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

async function fixture(
  page: Page,
  isolatedWorker: IsolatedWorker,
  complete = false,
) {
  const username = `welcome${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const user = await isolatedWorker.database.owner.user.create({
    data: {
      id: crypto.randomUUID(),
      email: `${username}@example.test`,
      name: complete ? "Welcome contract" : "",
      username: complete ? username : null,
    },
  });
  const session = await isolatedWorker.createSession(user.id);
  await page.context().addCookies([session.cookie]);
  return {
    user,
    username,
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

test("user.profile-field-labels", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  baseURL,
  isolatedWorker,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    if (!baseURL) throw new Error("Missing Playwright baseURL");
    const f = await fixture(page, isolatedWorker);
    for (const [locale, nickname] of [
      ["zh-cn", "昵称"],
      ["en-us", "Nickname"],
    ]) {
      await page
        .context()
        .addCookies([{ name: "NEXT_LOCALE", value: locale, url: baseURL }]);
      for (const complete of [false, true]) {
        await isolatedWorker.database.owner.user.update({
          where: { id: f.user.id },
          data: {
            name: complete ? "Chosen nickname" : "",
            username: complete ? f.username : null,
          },
        });
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
    return async () => {
      expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
        {
          ...f.user,
          name: "Chosen nickname",
          username: f.username,
          updatedAt: expect.any(Date),
        },
      ]);
    };
  });
});

async function expectStep(page: Page, step: 1 | 2 | 3) {
  await expect(
    page.getByText(new RegExp(`第 ${step} 步|Step ${step} of`, "i")),
  ).toBeVisible();
  await expect(nameInput(page)).toHaveCount(step === 1 ? 1 : 0);
  await expect(skip(page)).toHaveCount(step === 2 ? 1 : 0);
  await expect(finish(page)).toHaveCount(step === 3 ? 1 : 0);
}
test("user.welcome-flow-required", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  isolatedWorker,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    await gotoAndWaitForReady(page, "/account/welcome", {
      expectMainContent: false,
    });
    await expect(page).toHaveURL(/\/account\/sign-in\?/);
    const f = await fixture(page, isolatedWorker);
    for (const profile of [
      { name: "", username: "" },
      { name: "Existing name", username: "" },
      { name: "", username: f.username },
    ]) {
      await isolatedWorker.database.owner.user.update({
        where: { id: f.user.id },
        data: profile,
      });
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
    return async () => {
      expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
        {
          ...f.user,
          name: "",
          username: f.username,
          updatedAt: expect.any(Date),
        },
      ]);
    };
  });
});

test("user.welcome-staged-steps", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  isolatedWorker,
}) => {
  await accountRun(
    {
      writes: [
        [
          "/account/welcome",
          200,
          "complete",
          "/account/welcome?step=subscriptions&callbackUrl=%2Faccount%2Fsettings%2Fprofile%3Fwelcome%3Ddone",
        ],
      ],
      audits: ["account_profile_update"],
    },
    async () => {
      const f = await fixture(page, isolatedWorker);
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
        await isolatedWorker.database.owner.user.findUniqueOrThrow({
          where: { id: f.user.id },
        }),
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
      return async () => {
        expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
          {
            ...f.user,
            name: "Welcome contract",
            username: f.username,
            updatedAt: expect.any(Date),
          },
        ]);
      };
    },
  );
});

test("user.welcome-shell-isolation", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  isolatedWorker,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    const f = await fixture(page, isolatedWorker);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [index, step] of [
        "profile",
        "subscriptions",
        "finish",
      ].entries()) {
        await isolatedWorker.database.owner.user.update({
          where: { id: f.user.id },
          data: {
            name: index ? "Welcome contract" : "",
            username: index ? f.username : null,
          },
        });
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
    return async () => {
      expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
        {
          ...f.user,
          name: "Welcome contract",
          username: f.username,
          updatedAt: expect.any(Date),
        },
      ]);
    };
  });
});

test("user.welcome-completion-resume", { tag: "@Account/Web" }, async ({
  accountRun,
  page,
  isolatedWorker,
}) => {
  await accountRun({ writes: [], audits: [] }, async () => {
    const f = await fixture(page, isolatedWorker, true);
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
    return async () => {
      expect(await isolatedWorker.database.owner.user.findMany()).toEqual([
        {
          ...f.user,
          name: "Welcome contract",
          username: f.username,
          updatedAt: expect.any(Date),
        },
      ]);
    };
  });
});
