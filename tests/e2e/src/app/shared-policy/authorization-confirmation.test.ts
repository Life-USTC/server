import { expect, test } from "@playwright/test";
import {
  createOAuthAuthorizationFixture,
  deleteOAuthClientsByName,
} from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { gotoAndWaitForReady } from "../../../utils/page-ready";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("ui.settings-navigation-5", async ({ page }) => {
  for (const locale of ["en-us", "zh-cn"]) {
    const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    const user = await withE2ePrisma((db) =>
      db.user.create({
        data: {
          name: `Grant owner ${suffix}`,
          username: `grant${suffix}`,
          email: `grant-${suffix}@example.test`,
        },
      }),
    );
    const grants = [];
    try {
      for (const label of ["Selected application", "Other application"]) {
        grants.push(
          await createOAuthAuthorizationFixture({
            name: `${label} ${suffix}`,
            userId: user.id,
            scopes: ["workspace.todo:read"],
          }),
        );
      }
      const cookie = await createSignedSessionCookie(user.id);
      await page.context().clearCookies();
      await page
        .context()
        .addCookies([
          cookie,
          { name: "NEXT_LOCALE", value: locale, url: cookie.url },
        ]);
      await page.setViewportSize({
        width: locale === "en-us" ? 1280 : 390,
        height: 844,
      });
      await gotoAndWaitForReady(page, "/account/settings/authorizations");
      const revoke = locale === "en-us" ? "Revoke" : "撤销授权";
      const cancel = locale === "en-us" ? "Cancel" : "取消";
      const dialogTitle =
        locale === "en-us"
          ? "Revoke application access?"
          : "撤销应用访问权限？";
      const selected = page
        .getByRole("listitem")
        .filter({ hasText: grants[0].name });
      const other = page
        .getByRole("listitem")
        .filter({ hasText: grants[1].name });
      const original = await withE2ePrisma((db) =>
        db.oAuthConsent.findMany({
          where: { userId: user.id },
          orderBy: { id: "asc" },
        }),
      );
      let mutations = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("revokeAuthorization")
        )
          mutations++;
      });
      for (const dismiss of ["cancel", "escape"]) {
        await selected
          .getByRole("button", { name: revoke, exact: true })
          .click();
        const dialog = page.getByRole("alertdialog", {
          name: dialogTitle,
          exact: true,
        });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(grants[0].name);
        await expect(dialog).not.toContainText(grants[1].name);
        await expect(
          dialog.getByRole("button", { name: cancel, exact: true }),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", { name: revoke, exact: true }),
        ).toBeVisible();
        expect(mutations).toBe(0);
        expect(
          await withE2ePrisma((db) =>
            db.oAuthConsent.findMany({
              where: { userId: user.id },
              orderBy: { id: "asc" },
            }),
          ),
        ).toEqual(original);
        if (dismiss === "cancel")
          await dialog
            .getByRole("button", { name: cancel, exact: true })
            .click();
        else await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(selected).toBeVisible();
        await expect(other).toBeVisible();
        expect(mutations).toBe(0);
      }
      await selected.getByRole("button", { name: revoke, exact: true }).click();
      await page
        .getByRole("alertdialog", { name: dialogTitle, exact: true })
        .getByRole("button", { name: revoke, exact: true })
        .click();
      await expect(selected).toHaveCount(0);
      await expect(other).toBeVisible();
      expect(mutations).toBe(1);
      expect(
        await withE2ePrisma((db) =>
          db.oAuthConsent.findMany({
            where: { userId: user.id },
            select: { id: true },
          }),
        ),
      ).toEqual([{ id: grants[1].consentId }]);
    } finally {
      for (const grant of grants) await deleteOAuthClientsByName(grant.name);
      await withE2ePrisma(async (db) => {
        await db.auditLog.deleteMany({
          where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
        });
        await db.user.delete({ where: { id: user.id } });
      });
    }
  }
});
