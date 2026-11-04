import { expect } from "@playwright/test";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";
import { test } from "../../../../utils/section-subscription-fixture";

const locale =
  process.env.SUBSCRIPTION_KIND_LOCALE === "zh-cn" ? "zh-cn" : "en-us";

for (const kind of ["regular", "auditor", "teaching_assistant"] as const) {
  test(
    `section displays personal subscription kind ${kind}`,
    { tag: "@Subscription/Web" },
    async (
      { page, memberSection: section, isolatedWorker, sectionRun },
      testInfo,
    ) => {
      await sectionRun({ writes: [], calendar: null }, async () => {
        const db = isolatedWorker.database.owner;
        await db.userSectionSubscription.create({
          data: { userId: section.userId, sectionId: section.id, kind },
        });
        await page
          .context()
          .addCookies([
            { name: "NEXT_LOCALE", value: locale, url: isolatedWorker.origin },
          ]);
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await gotoAndWaitForReady(page, section.path);
          await expect(
            page
              .getByRole("button", {
                name:
                  locale === "zh-cn"
                    ? "取消订阅教学班"
                    : "Unsubscribe from section",
                exact: true,
              })
              .filter({ visible: true }),
          ).toBeVisible();
          const relationship = page.getByRole("region", {
            name: locale === "zh-cn" ? "我的订阅身份" : "My subscription",
          });
          await testInfo.attach(`kind-${kind}-${width}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
          await expect(relationship).toContainText(
            kind === "regular"
              ? locale === "zh-cn"
                ? "普通"
                : "Regular"
              : kind === "auditor"
                ? locale === "zh-cn"
                  ? "旁听"
                  : "Auditor"
                : locale === "zh-cn"
                  ? "助教"
                  : "Teaching assistant",
          );
          await expect(
            relationship.getByRole("link", {
              name: locale === "zh-cn" ? "管理订阅身份" : "Manage subscription",
            }),
          ).toHaveAttribute("href", "/workspace/subscriptions");
        }
        expect((await db.userSectionSubscription.findFirstOrThrow()).kind).toBe(
          kind,
        );
      });
    },
  );
}
