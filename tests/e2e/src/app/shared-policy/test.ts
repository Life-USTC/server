import { expect, type Page } from "@playwright/test";
import { test } from "../../../utils/catalog-search-fixture";
import { DEV_SEED } from "../../../utils/dev-seed";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { test as taskFilterTest } from "../../../utils/workspace-task-filters";

const viewports = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
];
const locales = ["zh-cn", "en-us"] as const;
const workspace = {
  overview: ["总览", "Overview"],
  calendar: ["日历", "Calendar"],
  homeworks: ["作业", "Homework"],
  todos: ["待办", "Todos"],
  exams: ["考试", "Exams"],
  subscriptions: ["教学班订阅", "Section Subscriptions"],
} as const;

async function setLocale(
  page: Page,
  locale: string,
  headers?: Record<string, string>,
) {
  const response = await page.request.post("/api/account/preferences", {
    data: { locale },
    headers,
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(
    (await page.context().cookies(response.url())).find(
      (cookie) => cookie.name === "NEXT_LOCALE",
    )?.value,
  ).toBe(locale);
}

async function catalogPages(page: Page) {
  await gotoAndWaitForReady(
    page,
    `/catalog/teachers?search=${encodeURIComponent(DEV_SEED.teacher.code)}`,
  );
  const teacherHref = await page
    .locator('#main-content a[href^="/catalog/teachers/"]:visible')
    .first()
    .getAttribute("href");
  expect(teacherHref).toBeTruthy();
  return [
    {
      href: `/catalog/courses/${DEV_SEED.course.jwId}`,
      collection: "/catalog/courses",
      names: [DEV_SEED.course.nameCn, DEV_SEED.course.nameEn],
    },
    {
      href: `/catalog/sections/${DEV_SEED.section.jwId}`,
      collection: "/catalog/sections",
      names: [DEV_SEED.course.nameCn, DEV_SEED.course.nameEn],
    },
    {
      href: teacherHref as string,
      collection: "/catalog/teachers",
      names: [DEV_SEED.teacher.nameCn, DEV_SEED.teacher.nameEn],
    },
  ];
}

async function openMobileMenu(page: Page) {
  await page
    .locator("[data-shell-topbar]")
    .getByRole("button", { name: /^菜单$|^Menu$/i })
    .click();
  await expect(
    page.locator('[data-shell-navigation="secondary"]'),
  ).toBeVisible();
}

async function assertReadingOrder(page: Page, items: readonly string[]) {
  const actual = await page
    .locator("[data-detail-reading-stream] > section[id]")
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(actual).toEqual(items);
  let previousBottom = -Infinity;
  for (const id of items) {
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error(`Missing section ${id}`);
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    previousBottom = box.y + box.height;
  }
}

test("ui.detail-two-column-stream-2", { tag: "@Section/Web" }, async ({
  page,
  preferenceFlow,
  searchSection: _searchSection,
}) => {
  await preferenceFlow.run(async () => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await gotoAndWaitForReady(
        page,
        `/catalog/sections/${DEV_SEED.section.jwId}`,
      );
      await assertReadingOrder(page, [
        "introduction",
        "calendar",
        "exams",
        "homework",
        "comments",
      ]);
    }
  });
});

for (const domain of ["Course", "Teacher"] as const) {
  test(`ui.detail-two-column-stream-3 ${domain}`, {
    tag: `@${domain}/Web`,
  }, async ({ page, preferenceFlow, searchSection: _searchSection }) => {
    await preferenceFlow.run(async () => {
      const pages = (await catalogPages(page)).filter(
        (p) => p.collection === `/catalog/${domain.toLowerCase()}s`,
      );
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        for (const { href } of pages) {
          await gotoAndWaitForReady(page, href);
          await assertReadingOrder(page, [
            "introduction",
            "sections",
            "comments",
          ]);
        }
      }
    });
  });
}

for (const domain of ["Course", "Section", "Teacher"] as const) {
  test(`ui.detail-hero-2 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const pages = (await catalogPages(page)).filter(
        (p) => p.collection === `/catalog/${domain.toLowerCase()}s`,
      );
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        for (const { href, collection } of pages) {
          await gotoAndWaitForReady(page, href);
          if (viewport.width < 768) await openMobileMenu(page);
          const navigation = page.locator(
            `[data-shell-navigation="${viewport.width < 768 ? "secondary" : "desktop"}"]`,
          );
          const link = navigation.locator(`a[href="${collection}"]`);
          await expect(link).toBeVisible();
          await link.click();
          await expect(page).toHaveURL(new RegExp(`${collection}$`));
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        }
      }
    });
  });
}

for (const domain of ["Course", "Section", "Teacher"] as const) {
  test(`ui.detail-hero-3 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      const pages = (await catalogPages(page)).filter(
        (p) => p.collection === `/catalog/${domain.toLowerCase()}s`,
      );
      for (const [index, locale] of locales.entries()) {
        await setLocale(page, locale);
        for (const { href, collection, names } of pages) {
          await gotoAndWaitForReady(page, href);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(
            locale === "en-us" && collection !== "/catalog/sections"
              ? `${names[1]} (${names[0]})`
              : names[index],
          );
        }
      }
    });
  });
}

for (const domain of ["Course", "Section", "Teacher"] as const) {
  test(`ui.layout-principles-1 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize(viewports[0]);
      for (const { href, collection } of (await catalogPages(page)).filter(
        (p) => p.collection === `/catalog/${domain.toLowerCase()}s`,
      )) {
        await gotoAndWaitForReady(page, href);
        const column = page.locator("[data-detail-reading-stream]");
        for (const id of [
          "introduction",
          "comments",
          ...(collection === "/catalog/sections" ? ["homework"] : []),
        ]) {
          await expect(column.locator(`#${id}`)).toHaveCount(1);
          const reading = await column.locator(`#${id}`).boundingBox();
          const aside = await page
            .locator("[data-detail-scroll-container] aside")
            .boundingBox();
          expect(reading).not.toBeNull();
          expect(aside).not.toBeNull();
          if (!reading || !aside)
            throw new Error("Missing reading/sidebar geometry");
          expect(reading.x + reading.width).toBeLessThan(aside.x);
        }
      }
    });
  });
}

for (const domain of ["Course", "Section", "Teacher"] as const) {
  test(`ui.layout-principles-2 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    preferenceFlow,
    searchSection: _searchSection,
  }) => {
    await preferenceFlow.run(async () => {
      await page.setViewportSize(viewports[0]);
      for (const { href } of (await catalogPages(page)).filter(
        (p) => p.collection === `/catalog/${domain.toLowerCase()}s`,
      )) {
        await gotoAndWaitForReady(page, href);
        const aside = page.locator("[data-detail-scroll-container] aside");
        await expect(page.locator("#overview")).toBeVisible();
        await expect(aside.locator("dl, table").first()).toBeVisible();
        const main = await page.locator("#introduction").boundingBox();
        const facts = await aside.boundingBox();
        expect(main).not.toBeNull();
        expect(facts).not.toBeNull();
        if (!main || !facts) throw new Error("Missing detail columns");
        expect(facts.x).toBeGreaterThan(main.x + main.width);
      }
    });
  });
}

for (const [index, locale] of locales.entries()) {
  for (const [domain, tab] of [
    ["Overview", "overview"],
    ["Calendar", "calendar"],
    ["Homework", "homeworks"],
    ["Todo", "todos"],
    ["Exam", "exams"],
    ["Subscription", "subscriptions"],
  ] as const) {
    taskFilterTest(
      `workspace branch identities ${locale}/${viewports[index].width} ${domain}`,
      { tag: `@${domain}/Web` },
      async ({ page, isolatedWorker, taskFilterRun }) => {
        taskFilterTest.setTimeout(90_000);
        await taskFilterRun(
          async ({ checkpoint }) => {
            // Locale is browser state; this consumer does not exercise its editor.
            await page.context().addCookies([
              {
                name: "NEXT_LOCALE",
                value: locale,
                url: isolatedWorker.origin,
              },
            ]);
            await page.setViewportSize(viewports[index]);
            for (const titles of [workspace[tab]]) {
              await taskFilterTest.step(
                `${tab}: heading, landmark and title`,
                async () => {
                  const route = `/workspace/${tab}`;
                  const response = await gotoAndWaitForReady(page, route);
                  expect(response?.status()).toBe(200);
                  expect(response?.headers()["content-language"]).toBe(locale);
                  expect(response?.headers()["cache-control"]).toBe(
                    "private, no-store",
                  );
                  expect(
                    response?.headers()["cloudflare-cdn-cache-control"],
                  ).toBe("no-store");
                  await expect(page).toHaveURL(
                    new URL(route, isolatedWorker.origin).href,
                  );
                  await expect(page.locator("html")).toHaveAttribute(
                    "lang",
                    locale,
                  );
                  await expect(
                    page.getByRole("heading", { level: 1 }),
                  ).toHaveCount(1);
                  await expect(
                    page.getByRole("heading", { level: 1 }),
                  ).toHaveText(titles[index]);
                  await expect(page.getByRole("main")).toHaveCount(1);
                  await expect(page.getByRole("main")).toHaveAccessibleName(
                    titles[index],
                  );
                  await expect(page).toHaveTitle(
                    `${titles[index]} - Life@USTC`,
                  );
                  await checkpoint(`${locale}/${tab}`, {
                    calendarMessages: [],
                    calendarTokenCreated: [
                      "calendar",
                      "exams",
                      "subscriptions",
                    ].includes(tab),
                  });
                },
              );
            }
          },
          {
            calendarMessages: [],
            calendarTokenCreated: [
              "calendar",
              "exams",
              "subscriptions",
            ].includes(tab),
          },
        );
      },
    );
  }
}

test("ui.navigation-landmarks-1", { tag: "@Site/Web" }, async ({
  page,
  preferenceFlow,
  searchSection: _searchSection,
}) => {
  await preferenceFlow.run(async () => {
    await page.setViewportSize(viewports[0]);
    for (const locale of locales) {
      await setLocale(page, locale);
      await gotoAndWaitForReady(page, "/catalog/courses");
      const nav = page.getByRole("navigation", {
        name: locale === "zh-cn" ? "主导航" : "Primary navigation",
        exact: true,
      });
      await expect(nav).toHaveCount(1);
      await expect(nav).toBeVisible();
    }
  });
});

taskFilterTest(
  "ui.navigation-landmarks-2",
  { tag: "@Site/Web" },
  async ({ page, taskFilterRun }) => {
    await taskFilterRun(
      async ({ headers, checkpoint }) => {
        await page.setViewportSize(viewports[1]);
        await gotoAndWaitForReady(page, "/workspace/overview");
        for (const locale of locales) {
          await setLocale(page, locale, headers);
          await gotoAndWaitForReady(page, "/workspace/overview");
          await expect(
            page.getByRole("navigation", {
              name:
                locale === "zh-cn" ? "移动主导航" : "Mobile primary navigation",
              exact: true,
            }),
          ).toBeVisible();
          await openMobileMenu(page);
          await expect(
            page.getByRole("navigation", {
              name: locale === "zh-cn" ? "次级导航" : "Secondary navigation",
              exact: true,
            }),
          ).toBeVisible();
        }
        await checkpoint("mobile navigation has no calendar side effects", {
          calendarMessages: [],
          calendarTokenCreated: false,
        });
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  },
);

taskFilterTest(
  "ui.navigation-landmarks-3",
  { tag: "@Site/Web" },
  async ({ page, taskFilterRun }) => {
    await taskFilterRun(
      async ({ checkpoint }) => {
        await gotoAndWaitForReady(page, "/workspace/overview");
        for (const viewport of viewports) {
          await page.setViewportSize(viewport);
          for (const href of [
            "/workspace/todos",
            "/catalog/courses",
            "/account/settings/preferences",
          ]) {
            await gotoAndWaitForReady(page, href);
            if (viewport.width < 768) await openMobileMenu(page);
            for (const nav of await page.getByRole("navigation").all()) {
              expect(
                await nav.locator('[aria-current="page"]').count(),
              ).toBeLessThanOrEqual(1);
            }
          }
        }
        await checkpoint(
          "navigation does not create a personal calendar token",
          {
            calendarMessages: [],
            calendarTokenCreated: false,
          },
        );
      },
      { calendarMessages: [], calendarTokenCreated: false },
    );
  },
);

test("ui.footer-navigation-landmark", { tag: "@Site/Web" }, async ({
  page,
  preferenceFlow,
  searchSection: _searchSection,
}) => {
  await preferenceFlow.run(async () => {
    for (const href of ["/catalog/courses", "/terms", "/privacy"]) {
      await gotoAndWaitForReady(page, href);
      const footer = page.locator("footer");
      await expect(footer).toBeVisible();
      const navigation = footer.getByRole("navigation");
      await expect(navigation).toHaveCount(1);
      await expect(navigation).toHaveAccessibleName(/.+/);
      expect(await navigation.getByRole("link").count()).toBe(
        await footer.getByRole("link").count(),
      );
    }
  });
});

test("ui.workspace-footer-policy-1", { tag: "@Site/Web" }, async ({
  page,
  preferenceFlow,
  searchSection: _searchSection,
}) => {
  await preferenceFlow.run(async () => {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const href of [
        "/catalog/courses",
        "/catalog/sections",
        "/catalog/teachers",
        "/terms",
        "/privacy",
        "/usage/mobile",
      ]) {
        await gotoAndWaitForReady(page, href);
        const footer = page.locator("footer");
        await expect(footer).toBeVisible();
        for (const destination of ["/terms", "/privacy", "/usage/mobile"]) {
          await expect(
            footer.locator(`a[href="${destination}"]`),
          ).toBeVisible();
        }
      }
    }
  });
});

test("ui.public-legal-help-navigation", { tag: "@Site/Web" }, async ({
  page,
  preferenceFlow,
  searchSection: _searchSection,
}) => {
  await preferenceFlow.run(async () => {
    test.setTimeout(60_000);
    const pages = await catalogPages(page);
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const { href } of pages) {
        for (const destination of ["/terms", "/privacy", "/usage/mobile"]) {
          await gotoAndWaitForReady(page, href);
          if (viewport.width < 768) await openMobileMenu(page);
          const nav = page.locator(
            `[data-shell-navigation="${viewport.width < 768 ? "secondary" : "desktop"}"]`,
          );
          const link = nav.locator(`a[href="${destination}"]`);
          await expect(link).toBeVisible();
          await link.click();
          await expect(page).toHaveURL(new RegExp(`${destination}$`));
          await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        }
      }
    }
  });
});

for (const [domain, tab] of [
  ["Homework", "homeworks"],
  ["Todo", "todos"],
  ["Exam", "exams"],
] as const) {
  taskFilterTest(
    `ui.workspace-filters-and-empty-states-3 ${domain}`,
    { tag: `@${domain}/Web` },
    async ({ page, taskFilterState, taskFilterRun }) => {
      await taskFilterState(false);
      await taskFilterRun(
        async () => {
          for (const viewport of viewports) {
            await page.setViewportSize(viewport);
            {
              await gotoAndWaitForReady(page, `/workspace/${tab}`);
              const clear = page
                .getByRole("button", { name: /清除筛选|Clear filter/i })
                .filter({ visible: true });
              const empty = page
                .locator('[data-slot="empty"]')
                .filter({ has: clear });
              await expect(empty).toBeVisible();
              await expect(empty.locator("svg, img")).toHaveCount(0);
              expect(
                await empty.evaluate((node) => ({
                  background: getComputedStyle(node).backgroundColor,
                  align: getComputedStyle(node).textAlign,
                })),
              ).toEqual({ background: "rgba(0, 0, 0, 0)", align: "left" });
              const description = empty.locator(
                '[data-slot="empty-description"]',
              );
              await expect(description).toBeVisible();
              const descriptionBox = await description.boundingBox();
              const clearBox = await clear.boundingBox();
              if (!descriptionBox || !clearBox)
                throw new Error("Missing empty-state geometry");
              expect(clearBox.y).toBeGreaterThan(
                descriptionBox.y + descriptionBox.height,
              );
              expect(
                await clear.evaluate((node) =>
                  Number.parseFloat(getComputedStyle(node).borderTopWidth),
                ),
              ).toBeGreaterThan(0);
              if (viewport.width >= 768)
                await expect(
                  page.getByRole("columnheader").first(),
                ).toBeVisible();
            }
          }
        },
        { calendarMessages: [], calendarTokenCreated: tab === "exams" },
      );
    },
  );
}

for (const [domain, tab] of [
  ["Homework", "homeworks"],
  ["Todo", "todos"],
  ["Exam", "exams"],
] as const) {
  taskFilterTest(
    `ui.workspace-filters-and-empty-states-5 ${domain}`,
    { tag: `@${domain}/Web` },
    async ({ page, taskFilterState, taskFilterRun }) => {
      const fixture = await taskFilterState(false);
      await taskFilterRun(
        async () => {
          {
            await gotoAndWaitForReady(page, `/workspace/${tab}`);
            const clear = page
              .getByRole("button", { name: /清除筛选|Clear filter/i })
              .filter({ visible: true });
            const empty = page
              .locator('[data-slot="empty"]')
              .filter({ has: clear });
            await expect(empty.locator('[data-slot="empty-title"]')).toHaveText(
              /.+/,
            );
            await expect(
              empty.locator('[data-slot="empty-description"]'),
            ).toHaveText(/.+/);
            await clear.click();
            await expect(
              page.locator('[data-slot="toggle-group"] [aria-checked="true"]'),
            ).toHaveAttribute("data-value", "all");
            await expect(clear).toHaveCount(0);
            await expect(
              page
                .locator(
                  tab === "exams"
                    ? '[data-testid="room-map-preview"]'
                    : "#main-content",
                )
                .filter({
                  hasText:
                    fixture.completedTitle[
                      tab as keyof typeof fixture.completedTitle
                    ],
                })
                .filter({ visible: true })
                .first(),
            ).toBeVisible();
          }
        },
        { calendarMessages: [], calendarTokenCreated: tab === "exams" },
      );
    },
  );
}
