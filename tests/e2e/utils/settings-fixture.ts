import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { User } from "../../../src/generated/prisma-node/client";
import { ensureLinkedAccountFixture } from "./e2e-db/oauth";
import { withE2ePrisma } from "./e2e-db/prisma";
import { test as accountTest } from "./isolated-account";
import { gotoAndWaitForReady } from "./page-ready";
import { absoluteTestUrl } from "./request-url";

type Authorization = {
  clientId: string;
  clientSecret: string;
  clientUri: string;
  consentId: string;
  name: string;
  redirectUri: string;
};
export const test = accountTest.extend<{
  profile: User;
  credential: { email: string; password: string };
  ustcAccount: Awaited<ReturnType<typeof ensureLinkedAccountFixture>>;
  githubAccount: Awaited<ReturnType<typeof ensureLinkedAccountFixture>>;
  authorization: Authorization;
}>({
  profile: async ({ account, baseURL }, use) => {
    const image = absoluteTestUrl("/images/icon.png", baseURL);
    const profile = await withE2ePrisma((db) =>
      db.user.update({
        where: { id: account.id },
        data: { image, profilePictures: [image] },
      }),
    );
    await use(profile);
  },
  credential: async ({ account }, use) => {
    const password = `E2e-${crypto.randomUUID()}`;
    const hashedPassword = await hashPassword(password);
    await withE2ePrisma((db) =>
      db.account.create({
        data: {
          userId: account.id,
          provider: "credential",
          issuer: createLocalAccountIssuer("credential"),
          providerAccountId: account.id,
          password: hashedPassword,
        },
      }),
    );
    await use({ email: account.email, password });
  },
  ustcAccount: async ({ account }, use) => {
    await use(
      await ensureLinkedAccountFixture({
        userId: account.id,
        provider: "oidc",
      }),
    );
  },
  githubAccount: async ({ account }, use) => {
    await use(
      await ensureLinkedAccountFixture({
        userId: account.id,
        provider: "github",
      }),
    );
  },
  authorization: async ({ account, page, baseURL }, use) => {
    const clientId = crypto.randomUUID();
    const clientSecret = `hidden-secret-${crypto.randomUUID()}`;
    const clientUri = "https://calendar.example";
    const redirectUri = absoluteTestUrl("/hidden-oauth-callback", baseURL);
    const name = `Private Calendar ${clientId.slice(0, 8)}`;
    const scopes = ["calendar:read", "profile"];
    const consent = await withE2ePrisma((db) =>
      db.$transaction(async (tx) => {
        await tx.oAuthClient.create({
          data: {
            clientId,
            clientSecret,
            name,
            redirectUris: [redirectUri],
            scopes,
            uri: clientUri,
          },
        });
        return tx.oAuthConsent.create({
          data: { clientId, scopes, userId: account.id },
        });
      }),
    );
    try {
      await use({
        clientId,
        clientSecret,
        clientUri,
        redirectUri,
        name,
        consentId: consent.id,
      });
    } finally {
      try {
        await page.close();
      } finally {
        await withE2ePrisma((db) =>
          db.oAuthClient.delete({ where: { clientId } }),
        );
      }
    }
  },
});

export async function expectSettingsPage(
  page: Page,
  path: string,
  testInfo: TestInfo,
) {
  const response = await gotoAndWaitForReady(page, path, {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: {},
    testInfo,
    screenshotLabel: "contract",
  });
  expect(response?.ok()).toBe(true);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /设置|Settings/i, level: 1 }),
  ).toBeVisible();
}

export function storedProfile(userId: string) {
  return withE2ePrisma((db) => db.user.findUnique({ where: { id: userId } }));
}
