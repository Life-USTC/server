import {
  arrangeSectionDetails,
  test,
} from "../../../../utils/catalog-detail-fixture";
/**
 * E2E: /catalog/sections/[jwId] — Page contract, display fields, layout, and description
 */

import { expect } from "@playwright/test";
import { formatSemesterName } from "@/lib/text/format-semester-name";
import { openCommentComposer } from "../../../../utils/comments";
import {
  arrangeDescription,
  test as communityTest,
  storedDescription,
  storedDescriptionAudits,
  supplement,
} from "../../../../utils/community-fixture";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { observeAction } from "../../../../utils/observed-action";
import {
  gotoAndWaitForReady,
  waitForUiSettled,
} from "../../../../utils/page-ready";
import { assertPageContract } from "../../_shared/page-contract";
import {
  test as overlayTest,
  signInPrivateDebugUser,
} from "../../catalog-personal-overlay-fixture";
import { getDetailViewport, jumpToSection } from "./_helpers";

const SECTION_URL = `/catalog/sections/${DEV_SEED.section.jwId}`;

test.describe("/catalog/sections/[jwId] 班级详情页", () => {
  test("页面契约", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await assertPageContract(page, {
        routePath: "/catalog/sections/[jwId]",
      });
    });
  });

  test("无效参数返回 404", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
  }) => {
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, "/catalog/sections/999999999", {
        expectMainContent: false,
      });
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /页面不存在|Page Not Found/i }),
      ).toBeVisible();
    });
  });

  test("显示课程名称为 h1 与班级代码", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      const heading = page.getByRole("heading", { level: 1 }).first();
      await expect(heading).toContainText(
        new RegExp(`${DEV_SEED.course.nameCn}|${DEV_SEED.course.nameEn}`),
      );

      const headingText = (await heading.textContent())?.trim();
      const expectedSubtitle =
        headingText === DEV_SEED.course.nameEn
          ? DEV_SEED.course.nameCn
          : DEV_SEED.course.nameEn;
      await expect(
        heading.locator("xpath=following-sibling::*[1]"),
      ).toContainText(expectedSubtitle);
      // section.code (plain monospace text)
      const sectionCode = page
        .locator('[data-slot="catalog-code"]')
        .filter({ hasText: DEV_SEED.section.code })
        .first();
      await expect(sectionCode).toBeVisible();
      await expect(
        sectionCode.locator("xpath=ancestor::*[@data-slot='badge']"),
      ).toHaveCount(0);
      await expect(page.locator("#introduction")).toBeVisible();
    });
  });

  test("显示学期、校区与教师信息", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      const overview = page.locator("[data-detail-identity]");

      // section.semester.nameCn (locale-dependent: English short name on en-us)
      await expect(
        overview
          .getByText(DEV_SEED.semesterNameCn)
          .or(
            overview.getByText(
              formatSemesterName("en-us", DEV_SEED.semesterNameCn),
            ),
          )
          .first(),
      ).toBeVisible();
      // section.campus.namePrimary (locale-dependent)
      await expect(
        overview
          .getByText(DEV_SEED.campus.nameCn)
          .or(overview.getByText(DEV_SEED.campus.nameEn))
          .first(),
      ).toBeVisible();
      await jumpToSection(page, SECTION_URL, /教师|Teachers/i, "#teachers");
      // section.teachers[] — teacher badge/link (locale-dependent)
      await expect(
        page
          .getByText(DEV_SEED.teacher.nameCn)
          .or(page.getByText(DEV_SEED.teacher.nameEn))
          .first(),
      ).toBeVisible();
    });
  });

  test("显示学分、考试方式与备注", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      const facts = page
        .locator("dl")
        .filter({ hasText: /学分|Credits/i })
        .first();
      const creditsValue = facts
        .locator("dt")
        .filter({ hasText: /学分|Credits/i })
        .locator("xpath=following-sibling::dd[1]");
      const examModeValue = facts
        .locator("dt")
        .filter({ hasText: /^(方式|Mode)$/i })
        .locator("xpath=following-sibling::dd[1]");
      const remarkValue = facts
        .locator("dt")
        .filter({ hasText: /^(备注|Remark)$/i })
        .locator("xpath=following-sibling::dd[1]");

      // section.credits
      await expect(creditsValue).toHaveText(String(DEV_SEED.section.credits));
      // section.examMode.namePrimary (locale-dependent)
      await expect(examModeValue).toContainText(
        new RegExp(
          `${DEV_SEED.section.examModeNameCn}|${DEV_SEED.section.examModeNameEn}`,
          "i",
        ),
      );
      // section.remark (whitespace-preserved, language-neutral text)
      await expect(remarkValue).toContainText(DEV_SEED.section.remark);
    });
  });

  test("基本信息中显示授课语言与教室类型", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      await expect(
        page.getByRole("heading", { name: /^(更多信息|More Details)$/i }),
      ).toBeVisible();

      // section.teachLanguage.namePrimary (locale-dependent)
      await expect(
        page
          .getByText(DEV_SEED.section.teachLanguageNameCn)
          .or(page.getByText(DEV_SEED.section.teachLanguageNameEn))
          .first(),
      ).toBeVisible();
      // section.roomType.namePrimary (locale-dependent)
      await expect(
        page
          .getByText(DEV_SEED.section.roomTypeNameCn)
          .or(page.getByText(DEV_SEED.section.roomTypeNameEn))
          .first(),
      ).toBeVisible();
    });
  });

  test("显示行政班级（可折叠）", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      const classes = page
        .getByRole("heading", {
          name: /^(行政班级|Admin Classes)$/i,
        })
        .locator("..");
      await expect(classes.getByRole("heading")).toBeVisible();
      await expect(
        classes.getByRole("listitem").filter({
          hasText: new RegExp(
            `${DEV_SEED.section.adminClassNameCn}|${DEV_SEED.section.adminClassNameEn}`,
          ),
        }),
      ).toBeVisible();
    });
  });

  test("可见文本中不显示 jwId（仅 URL 规则）", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);
      // The page content should not contain the raw jwId as visible text
      const content = await page.locator("#main-content").innerText();
      // jwId should not appear as a standalone number in the visible UI
      expect(content).not.toMatch(new RegExp(`\\b${DEV_SEED.section.jwId}\\b`));
    });
  });

  test("详情流式布局包含主要锚点区块", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await gotoAndWaitForReady(page, SECTION_URL);

      await expect(page.locator("#introduction")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /日历|Calendar/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /作业|Homework/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /考试|Exams/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: /评论|Comments/i }),
      ).toBeVisible();

      await gotoAndWaitForReady(page, `${SECTION_URL}#homework`);
      await expect(page).toHaveURL(/\/catalog\/sections\/\d+#homework$/);
      await expect(page.locator("#homework")).toBeVisible();
    });
  });

  overlayTest(
    "移动端标题、流式区块与底部主操作保持可达",
    { tag: "@Catalog/Web" },
    async ({ page, overlay }) => {
      await overlay.run({ loginRedirect: SECTION_URL }, async () => {
        const runtimeErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") runtimeErrors.push(message.text());
        });
        page.on("pageerror", (error) => runtimeErrors.push(error.message));
        await page.setViewportSize({ width: 375, height: 900 });
        await signInPrivateDebugUser(page, SECTION_URL);

        const heading = page.getByRole("heading", { level: 1 }).first();
        await expect(heading).toHaveCSS("font-size", "24px");
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(375);

        const actions = page.getByTestId("section-mobile-primary-actions");
        const mobileNavigation = page.getByRole("navigation", {
          name: /移动主导航|Mobile primary navigation/i,
        });
        await expect(actions).toBeVisible();
        await expect(actions).toBeInViewport();
        const [actionsBox, navigationBox] = await Promise.all([
          actions.boundingBox(),
          mobileNavigation.boundingBox(),
        ]);
        expect(actionsBox).not.toBeNull();
        expect(navigationBox).not.toBeNull();
        expect(
          (actionsBox?.y ?? 0) + (actionsBox?.height ?? 0),
        ).toBeLessThanOrEqual((navigationBox?.y ?? 0) + 1);
        await actions
          .getByRole("button", { name: /添加到日历|Add to calendar/i })
          .click();
        await expect(
          page.locator('[data-slot="dialog-content"]').first(),
        ).toBeVisible();
        await page.keyboard.press("Escape");

        await jumpToSection(page, SECTION_URL, /评论|Comments/i, "#comments");
        await expect(actions).toBeInViewport();
        for (const width of [280, 320, 375]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, `${SECTION_URL}#comments`);
          await expect(actions).toBeInViewport();
          await expect(page.locator("#comments")).toBeVisible();
          await expect
            .poll(() =>
              page.evaluate((viewportWidth) => {
                const mobileActions = document.querySelector<HTMLElement>(
                  '[data-testid="section-mobile-primary-actions"]',
                );
                const actionButtons = Array.from(
                  mobileActions?.querySelectorAll<HTMLElement>("button") ?? [],
                );
                const actionBox = mobileActions?.getBoundingClientRect();
                return {
                  actionButtonsFit:
                    actionBox != null &&
                    actionButtons.length === 2 &&
                    actionButtons.every((button) => {
                      const box = button.getBoundingClientRect();
                      return (
                        box.left >= actionBox.left - 1 &&
                        box.right <= actionBox.right + 1
                      );
                    }),
                  actionLayoutMatchesWidth:
                    actionButtons.length === 2 &&
                    (viewportWidth < 360
                      ? actionButtons[1].getBoundingClientRect().top >
                        actionButtons[0].getBoundingClientRect().top
                      : Math.abs(
                          actionButtons[1].getBoundingClientRect().top -
                            actionButtons[0].getBoundingClientRect().top,
                        ) < 1),
                  commentComposerFits: (() => {
                    const comments =
                      document.querySelector<HTMLElement>("#comments");
                    return (
                      comments != null &&
                      comments.scrollWidth <= comments.clientWidth + 1
                    );
                  })(),
                  documentFitsViewport:
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
                  windowScrollX: window.scrollX,
                };
              }, width),
            )
            .toEqual({
              actionButtonsFit: true,
              actionLayoutMatchesWidth: true,
              commentComposerFits: true,
              documentFitsViewport: true,
              windowScrollX: 0,
            });
        }
        await expect(page.locator("vite-error-overlay")).toHaveCount(0);
        expect(
          runtimeErrors.filter(
            (error) =>
              !error.startsWith(
                "Executing inline event handler violates the following Content Security Policy directive",
              ),
          ),
        ).toEqual([]);
      });
    },
  );

  overlayTest(
    "移动端评论编辑器不会让详情内容列横向滚动",
    { tag: "@Catalog/Web" },
    async ({ page, overlay }) => {
      await overlay.run({ loginRedirect: SECTION_URL }, async () => {
        await signInPrivateDebugUser(page, SECTION_URL);

        for (const width of [360, 390]) {
          await page.setViewportSize({ width, height: 844 });
          await gotoAndWaitForReady(page, `${SECTION_URL}#comments`);

          const detailViewport = getDetailViewport(page);
          await expect(detailViewport).toBeVisible();
          await expect(page.locator("#comments")).toBeVisible();

          const assertDetailViewportContained = async () => {
            const metrics = await detailViewport.evaluate((element) => ({
              clientWidth: element.clientWidth,
              overflowX: getComputedStyle(element).overflowX,
              scrollLeft: element.scrollLeft,
              scrollWidth: element.scrollWidth,
            }));
            expect(metrics.overflowX).toBe("hidden");
            expect(metrics.scrollLeft).toBe(0);
            expect(metrics.scrollWidth).toBeGreaterThanOrEqual(
              metrics.clientWidth,
            );
            expect(
              metrics.scrollWidth - metrics.clientWidth,
            ).toBeLessThanOrEqual(1);
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(width);
          };

          await assertDetailViewportContained();
          await openCommentComposer(page);
          await assertDetailViewportContained();
        }
      });
    },
  );

  test("桌面端保留页首主操作并隐藏移动端操作栏", {
    tag: "@Catalog/Web",
  }, async ({ page, preferenceFlow, detailCatalog, isolatedWorker }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(page, `${SECTION_URL}#comments`);

      await expect(
        page
          .getByTestId("detail-pinned-summary")
          .getByRole("button", { name: /添加到日历|Add to calendar/i }),
      ).toBeVisible();
      await expect(
        page.getByTestId("section-mobile-primary-actions"),
      ).toBeHidden();

      const comments = page.locator("#comments");
      await expect(
        comments
          .getByRole("link", {
            name: /登录.*评论|Log in to comment|Sign in to comment/i,
          })
          .or(
            comments.getByRole("button", {
              name: /登录.*评论|Log in to comment|Sign in to comment/i,
            }),
          ),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(1440);
    });
  });

  test("详情锚点导航滚动到目标区块", { tag: "@Catalog/Web" }, async ({
    page,
    preferenceFlow,
    detailCatalog,
    isolatedWorker,
  }) => {
    await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction((db) =>
        arrangeSectionDetails(db, detailCatalog),
      ),
    );
    await preferenceFlow.run(async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoAndWaitForReady(page, SECTION_URL);

      const detailViewport = getDetailViewport(page);
      await expect(detailViewport).toBeVisible();

      await gotoAndWaitForReady(page, `${SECTION_URL}#calendar`);
      await page.waitForURL(/\/catalog\/sections\/\d+#calendar$/);
      await waitForUiSettled(page);

      await expect(page.locator("#calendar")).toBeInViewport();
      await expect
        .poll(() =>
          getDetailViewport(page).evaluate((element) => element.scrollTop),
        )
        .toBeGreaterThan(8);
    });
  });

  communityTest(
    "已登录用户可编辑班级简介",
    { tag: "@Description/Web" },
    async ({ page, account, community, communityFlow }) => {
      await communityFlow.run(
        async () => {
          const description = await arrangeDescription(
            community.db,
            "section",
            community.section.id,
            account.id,
          );
          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${community.section.jwId}#introduction`,
          );
          const introduction = page.locator("#introduction");
          await expect(introduction).toBeVisible();
          await expect(
            introduction.getByTestId("description-edit"),
          ).toBeVisible({
            timeout: 60_000,
          });

          const content = `e2e-section-desc-${Date.now()}`;
          const editor = introduction.locator(
            '[data-slot="markdown-editor"] textarea',
          );
          const editButton = introduction.getByTestId("description-edit");
          await editButton.scrollIntoViewIfNeeded();
          await editButton.click();
          await expect(editor).toBeVisible();
          await editor.fill(content);
          await introduction
            .getByRole("tab", { name: /预览|Preview/i })
            .click();
          await expect(
            introduction
              .getByRole("tabpanel", { name: /预览|Preview/i })
              .getByText(content),
          ).toBeVisible();

          await observeAction(
            () =>
              page.waitForResponse(
                (r) =>
                  r.url().includes("/api/community/descriptions") &&
                  r.request().method() === "POST" &&
                  r.status() === 200,
              ),
            () =>
              introduction.getByRole("button", { name: /保存|Save/i }).click(),
          );
          await expect(
            introduction
              .getByRole("tabpanel", { name: /简介|Description/i })
              .getByText(content),
          ).toBeVisible();
          const persisted = await storedDescription(
            community.db,
            description.id,
          );
          expect(persisted).toMatchObject({
            content,
            lastEditedById: account.id,
            lastEditedAt: expect.any(Date),
          });
          expect(persisted?.edits).toEqual([
            expect.objectContaining({
              editorId: account.id,
              previousContent: supplement,
              nextContent: content,
            }),
          ]);
          await expect
            .poll(() => storedDescriptionAudits(community.db, description.id))
            .toEqual([
              expect.objectContaining({
                userId: account.id,
                action: "description_edit",
                outcome: "success",
              }),
            ]);
          await page.reload();
          await expect(
            introduction
              .getByRole("tabpanel", { name: /简介|Description/i })
              .getByText(content),
          ).toBeVisible();
        },
        { auditActions: { description_edit: 1 }, catalogPurges: 1 },
      );
    },
  );
});

test("页面契约", { tag: "@Catalog/Web" }, async ({
  page,
  preferenceFlow,
  detailCatalog,
  isolatedWorker,
}) => {
  await preferenceFlow.prepare(() =>
    isolatedWorker.database.owner.$transaction((db) =>
      arrangeSectionDetails(db, detailCatalog),
    ),
  );
  await preferenceFlow.run(async () => {
    await assertPageContract(page, {
      routePath: "/catalog/sections/[jwId]/[section]",
    });
  });
});
