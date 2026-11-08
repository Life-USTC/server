import { expect, type Page } from "@playwright/test";
import { createSignedDemoCookie } from "../../../../shared/demo-token";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test } from "../../../utils/owned-worker";
import {
  expectNoPageHorizontalOverflow,
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../utils/page-ready";
import { expectRenderedUiQuality } from "../../../utils/ui-quality";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

test(
  "demo.profile: private avatar selection cannot survive ordinary sign-out and demo entry",
  {
    tag: "@Account/Web",
  },
  async ({ page, isolatedWorker, run }, testInfo) => {
    await withBrowserWorkflow(page, async (workflow) =>
      workflow.run(() =>
        run(() =>
          workflow.body(async () => {
            const actor = await isolatedWorker.createActor();
            const currentImage = `${isolatedWorker.origin}/images/icon.png?private-avatar=current`;
            const selectedImage = `${isolatedWorker.origin}/images/icon.png?private-avatar=selected`;
            await isolatedWorker.database.owner.user.update({
              where: { id: actor.id },
              data: {
                name: "Private ordinary nickname",
                username: "private-demo-owner",
                image: currentImage,
                profilePictures: [currentImage, selectedImage],
              },
            });
            await page.setViewportSize({ width: 1280, height: 844 });
            await page.context().addCookies([
              actor.cookie,
              {
                name: "NEXT_LOCALE",
                value: "en-us",
                url: isolatedWorker.origin,
              },
            ]);
            await gotoAndWaitForReady(page, "/account/settings/profile");
            await expect(page.locator("#name")).toHaveValue(
              "Private ordinary nickname",
            );
            const choices = page.locator('[data-slot="toggle-group-item"]');
            await expect(choices).toHaveCount(2);
            await choices.nth(1).click();
            await expect(page.getByTestId("current-avatar")).toHaveAttribute(
              "src",
              selectedImage,
            );
            await expect(page.locator('input[name="image"]')).toHaveValue(
              selectedImage,
            );
            await page.screenshot({
              path: testInfo.outputPath("ordinary-selected-avatar.png"),
              fullPage: true,
            });
            await page.locator("#app-user-menu").click();
            await page
              .getByRole("menuitem", { name: "Sign Out", exact: true })
              .click();
            await expect(page).toHaveURL(`${isolatedWorker.origin}/`);
            await gotoAndWaitForReady(page, "/account/sign-in");
            await page
              .getByRole("button", { name: "Enter demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/workspace\/todos$/);
            await page
              .locator(
                'a[data-slot="sidebar-menu-button"][href="/account/settings/profile"]:visible',
              )
              .click();
            await waitForUiSettled(page);
            await expect(page.locator("#name")).toHaveValue(
              "Demo account · Read only",
            );
            await expect(page.locator("#username")).toHaveValue("demo-student");
            await expect(page.getByTestId("current-avatar")).toHaveAttribute(
              "src",
              "/images/icon.png",
            );
            await expect(
              page.locator('input[name="image"], img[src*="private-avatar"]'),
            ).toHaveCount(0);
            await expect(
              page.getByText("Private ordinary nickname", { exact: true }),
            ).toHaveCount(0);
            await expect(page.locator("#app-user-menu")).toHaveCount(0);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(
              "Profile",
            );
            await page.screenshot({
              path: testInfo.outputPath(
                "after-identity-profile-en-us-1280.png",
              ),
              fullPage: true,
            });
            expect(
              await (await page.request.get("/api/account/profile")).json(),
            ).toMatchObject({
              id: "demo:workspace-v1",
              image: null,
              username: "demo-student",
            });
            await page.reload();
            await waitForUiSettled(page);
            await expect(page.locator("#name")).toHaveValue(
              "Demo account · Read only",
            );
            await expect(page.getByTestId("current-avatar")).toHaveAttribute(
              "src",
              "/images/icon.png",
            );
            await page
              .getByRole("button", { name: "Exit demo", exact: true })
              .click();
            await expect(page).toHaveURL(/\/account\/sign-in$/);
            await page.goBack();
            await waitForUiSettled(page);
            await expect(page.locator("#username")).toHaveCount(0);
            await expect(
              page.locator('img[src*="private-avatar"]'),
            ).toHaveCount(0);
            expect(
              await isolatedWorker.database.owner.user.findUniqueOrThrow({
                where: { id: actor.id },
                select: {
                  name: true,
                  username: true,
                  image: true,
                  profilePictures: true,
                },
              }),
            ).toEqual({
              name: "Private ordinary nickname",
              username: "private-demo-owner",
              image: currentImage,
              profilePictures: [currentImage, selectedImage],
            });
          }),
        ),
      ),
    );
  },
);

async function expectReadableProfile(page: Page) {
  for (const id of ["name", "username"]) {
    const geometry = await page
      .locator(`#${id}`)
      .evaluate((input: HTMLInputElement) => {
        const style = getComputedStyle(input);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context || !style.font)
          throw new Error("Missing actual input font metrics");
        context.font = style.font;
        const spacing =
          style.letterSpacing === "normal"
            ? 0
            : Number.parseFloat(style.letterSpacing);
        return {
          value: input.value,
          textWidth:
            context.measureText(input.value).width +
            spacing * Math.max(0, input.value.length - 1),
          available:
            input.getBoundingClientRect().width -
            Number.parseFloat(style.borderLeftWidth) -
            Number.parseFloat(style.borderRightWidth) -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight),
        };
      });
    expect(geometry.value).not.toBe("");
    expect(
      geometry.textWidth,
      JSON.stringify({ id, ...geometry }),
    ).toBeLessThanOrEqual(geometry.available);
  }
  const notice = page.getByTestId("demo-notice");
  await notice.scrollIntoViewIfNeeded();
  const clipped = await notice.evaluate((root) => {
    const failures: unknown[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        if (
          rect.left < 0 ||
          rect.top < 0 ||
          rect.right > document.documentElement.clientWidth ||
          rect.bottom > window.innerHeight
        )
          failures.push({
            text: node.textContent,
            clip: "viewport",
            rect: rect.toJSON(),
          });
        for (
          let element = node.parentElement;
          element;
          element = element.parentElement
        ) {
          const style = getComputedStyle(element);
          const bounds = element.getBoundingClientRect();
          const x = /^(hidden|clip|auto|scroll)$/.test(style.overflowX);
          const y = /^(hidden|clip|auto|scroll)$/.test(style.overflowY);
          if (
            (x &&
              (rect.left <
                bounds.left + Number.parseFloat(style.borderLeftWidth) ||
                rect.right >
                  bounds.right - Number.parseFloat(style.borderRightWidth))) ||
            (y &&
              (rect.top <
                bounds.top + Number.parseFloat(style.borderTopWidth) ||
                rect.bottom >
                  bounds.bottom - Number.parseFloat(style.borderBottomWidth)))
          )
            failures.push({
              text: node.textContent,
              clip: element.tagName,
              rect: rect.toJSON(),
              bounds: bounds.toJSON(),
            });
        }
      }
    }
    return failures;
  });
  expect(clipped).toEqual([]);
}

for (const locale of ["en-us", "zh-cn"] as const)
  for (const width of [1280, 390])
    test(
      `demo.profile: existing read-only profile ${locale} ${width}`,
      {
        tag: "@Account/Web",
      },
      async ({ page, isolatedWorker, run }, testInfo) => {
        await withBrowserWorkflow(page, async (workflow) =>
          workflow.run(() =>
            run(() =>
              workflow.body(async () => {
                await page.setViewportSize({ width, height: 844 });
                await page.context().addCookies([
                  {
                    ...(await createSignedDemoCookie({
                      issuedAt: Math.floor(Date.now() / 1000),
                    })),
                    url: isolatedWorker.origin,
                  },
                  {
                    name: "NEXT_LOCALE",
                    value: locale,
                    url: isolatedWorker.origin,
                  },
                ]);
                await gotoAndWaitForReady(page, "/workspace/todos");
                if (width === 390)
                  await page
                    .getByRole("button", {
                      name: locale === "en-us" ? "Menu" : "菜单",
                      exact: true,
                    })
                    .click();
                const destination = page.locator(
                  'a[data-slot="sidebar-menu-button"][href="/account/settings/profile"]:visible',
                );
                await expect(destination).toHaveCount(1);
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-navigation-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
                await destination.click();
                await waitForUiSettled(page);
                await expect(page).toHaveURL(/\/account\/settings\/profile$/);
                await expect(
                  page.getByRole("heading", { level: 1 }),
                ).toHaveText(locale === "en-us" ? "Profile" : "个人资料");
                const identity =
                  locale === "en-us"
                    ? "Demo account · Read only"
                    : "演示账户 · 只读";
                await expect(page.getByTestId("demo-notice")).toContainText(
                  identity,
                );
                await expect(page.getByTestId("demo-notice")).toContainText(
                  locale === "en-us"
                    ? "Browse sample Home, calendar, todos, homework, exams, subscriptions, catalog details, account profile, news, sources, activities, organizers, weather, buses, route map, websites and room maps. Changes and external actions are disabled."
                    : "你可以浏览首页、日历、待办、作业、考试、订阅、课程目录详情、账户资料、新闻、来源、活动、组织者、天气、校车、线路图、网站和教室地图样例，无法修改数据或执行外部操作。",
                );
                await expect(page.locator("#name")).toHaveValue(identity);
                await expect(page.locator("#username")).toHaveValue(
                  "demo-student",
                );
                await expect(page.locator("#name")).toBeDisabled();
                await expect(page.locator("#username")).toBeDisabled();
                const form = page.locator('form[action="?/updateProfile"]');
                await expect(
                  form.getByRole("button", {
                    name: locale === "en-us" ? "Save changes" : "保存更改",
                    exact: true,
                  }),
                ).toBeDisabled();
                await expect(
                  form.locator('input[type="file"], input[name="image"]'),
                ).toHaveCount(0);
                await expect(
                  page.getByTestId("current-avatar"),
                ).toHaveAttribute("src", "/images/icon.png");
                await expect(
                  page.locator('a[href^="/community/users/"]'),
                ).toHaveCount(0);
                await expect(page.locator("#app-user-menu")).toHaveCount(0);
                const api = await page.request.get("/api/account/profile");
                expect(api.status()).toBe(200);
                expect(await api.json()).toMatchObject({
                  id: "demo:workspace-v1",
                  name: identity,
                  username: "demo-student",
                  image: null,
                });
                const html = await page.request.get(
                  "/account/settings/profile",
                );
                const disabled = await page.evaluate(
                  (source) => {
                    const document = new DOMParser().parseFromString(
                      source,
                      "text/html",
                    );
                    return ["name", "username"].map((id) => {
                      const input = document.getElementById(
                        id,
                      ) as HTMLInputElement | null;
                      return {
                        id,
                        value: input?.value,
                        disabled: input?.disabled,
                      };
                    });
                  },
                  await html.text(),
                );
                expect(disabled).toEqual([
                  { id: "name", value: identity, disabled: true },
                  { id: "username", value: "demo-student", disabled: true },
                ]);
                await expectRenderedUiQuality(page);
                await expectNoPageHorizontalOverflow(page);
                await expectReadableProfile(page);
                await page.screenshot({
                  path: testInfo.outputPath(
                    `after-profile-${locale}-${width}.png`,
                  ),
                  fullPage: true,
                });
                const writes: string[] = [];
                const observe = (request: {
                  method(): string;
                  url(): string;
                }) => {
                  if (
                    request.method() === "POST" &&
                    new URL(request.url()).pathname ===
                      "/account/settings/profile"
                  )
                    writes.push(request.url());
                };
                page.on("request", observe);
                await form.evaluate((element) =>
                  (element as HTMLFormElement).requestSubmit(),
                );
                await gotoAndWaitForReady(
                  page,
                  "/account/settings/profile?tab=accounts&message=Success",
                );
                await expect(page.locator("#name")).toHaveValue(identity);
                await expect(page.locator("[data-sonner-toast]")).toHaveCount(
                  0,
                );
                if (width === 390)
                  await page
                    .getByRole("button", {
                      name: locale === "en-us" ? "Menu" : "菜单",
                      exact: true,
                    })
                    .click();
                const settingsLinks = page.locator(
                  'a[href^="/account/settings/"]:visible',
                );
                expect(
                  await settingsLinks.evaluateAll((links) =>
                    links.map((link) => link.getAttribute("href")),
                  ),
                ).toEqual([
                  "/account/settings/profile",
                  "/account/settings/profile",
                ]);
                for (const label of locale === "en-us"
                  ? [
                      "Preferences",
                      "Linked accounts",
                      "Security activity",
                      "Authorized apps",
                      "Danger zone",
                    ]
                  : [
                      "偏好设置",
                      "关联账户",
                      "安全活动",
                      "已授权应用",
                      "危险操作",
                    ]) {
                  await expect(
                    page
                      .getByRole("button", { name: label, exact: true })
                      .filter({ visible: true }),
                  ).toBeDisabled();
                }
                if (width === 390) await page.keyboard.press("Escape");
                await page
                  .getByRole("button", {
                    name: locale === "en-us" ? "Exit demo" : "退出演示",
                    exact: true,
                  })
                  .click();
                await expect(page).toHaveURL(/\/account\/sign-in$/);
                expect(
                  (await page.context().cookies()).some(
                    (cookie) => cookie.name === "life-ustc.demo",
                  ),
                ).toBe(false);
                await page.goBack();
                await waitForUiSettled(page);
                await expect(page.locator("#username")).toHaveCount(0);
                await expect(page.getByTestId("demo-notice")).toHaveCount(0);
                expect(writes).toEqual([]);
                page.off("request", observe);
              }),
            ),
          ),
        );
      },
    );
