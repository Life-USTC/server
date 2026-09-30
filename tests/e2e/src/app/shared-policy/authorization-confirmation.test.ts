import { expect } from "@playwright/test";
import { test } from "../../../utils/owned-page";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

test("ui.settings-navigation-5", async ({ page, pageRun, isolatedWorker }) => {
  await pageRun(
    async () => {
      const db = isolatedWorker.database.owner;
      for (const locale of ["en-us", "zh-cn"]) {
        const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
        const { user, grants } = await db.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              name: `Grant owner ${suffix}`,
              username: `grant${suffix}`,
              email: `grant-${suffix}@example.test`,
            },
          });
          const grants = [];
          for (const label of ["Selected application", "Other application"]) {
            const clientId = crypto.randomUUID();
            const name = `${label} ${suffix}`;
            const scopes = ["workspace.todo:read"];
            await tx.oAuthClient.create({
              data: {
                clientId,
                clientSecret: `hidden-secret-${crypto.randomUUID()}`,
                name,
                redirectUris: [
                  `${isolatedWorker.origin}/hidden-oauth-callback`,
                ],
                scopes,
                uri: "https://calendar.example",
              },
            });
            const consent = await tx.oAuthConsent.create({
              data: { clientId, scopes, userId: user.id },
            });
            grants.push({
              name,
              clientId,
              consentId: consent.id,
              grantId: consent.grantId,
            });
          }
          return { user, grants };
        });
        const { cookie } = await isolatedWorker.createSession(user.id);
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
        const original = await db.oAuthConsent.findMany({
          where: { userId: user.id },
          orderBy: { id: "asc" },
        });
        const audits = () =>
          db.auditLog.findMany({
            where: { userId: user.id },
            select: {
              action: true,
              channel: true,
              outcome: true,
              userId: true,
              subjectUserId: true,
              targetId: true,
              targetType: true,
              oauthClientId: true,
              oauthGrantId: true,
              metadata: true,
            },
          });
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
            await db.oAuthConsent.findMany({
              where: { userId: user.id },
              orderBy: { id: "asc" },
            }),
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
          expect(await audits()).toEqual([]);
        }
        await selected
          .getByRole("button", { name: revoke, exact: true })
          .click();
        await page
          .getByRole("alertdialog", { name: dialogTitle, exact: true })
          .getByRole("button", { name: revoke, exact: true })
          .click();
        await expect(selected).toHaveCount(0);
        await expect(other).toBeVisible();
        expect(mutations).toBe(1);
        expect(
          await db.oAuthConsent.findMany({
            where: { userId: user.id },
            select: { id: true },
          }),
        ).toEqual([{ id: grants[1].consentId }]);
        // Revocation and its audit commit in the same transaction. Observe the
        // selected grant explicitly; cancel/Escape must not create an audit.
        expect(await audits()).toEqual([
          {
            action: "oauth_authorization_revoke",
            channel: "web",
            outcome: "success",
            userId: user.id,
            subjectUserId: user.id,
            targetType: "oauth_consent",
            targetId: grants[0].consentId,
            oauthClientId: grants[0].clientId,
            oauthGrantId: grants[0].grantId,
            metadata: {
              revokedAccessTokenCount: 0,
              revokedDeviceCodeCount: 0,
              revokedRefreshTokenCount: 0,
            },
          },
        ]);
      }
    },
    async (response, request) => {
      const url = new URL(request.url());
      expect(request.method()).toBe("POST");
      expect(url.pathname).toBe("/account/settings/authorizations");
      expect(url.search).toContain("revokeAuthorization");
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        type: "redirect",
        status: 303,
        location:
          "/account/settings/authorizations?message=AuthorizationRevoked",
      });
    },
  );
});
