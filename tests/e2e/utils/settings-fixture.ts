import {
  createLocalAccountIssuer,
  createOAuthAccountIssuer,
} from "@better-auth/core/db";
import { expect, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { User } from "../../../src/generated/prisma-node/client";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as accountTest } from "./account-fixture";
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

async function arrangeLinkedAccount(
  db: TestPrismaClient,
  userId: string,
  provider: "github" | "oidc",
) {
  const marker = crypto.randomUUID();
  const providerAccountId = `${provider}-e2e-${marker}`;
  const email = `${provider}-${marker}@example.test`;
  await db.$transaction(async (db) => {
    await db.account.create({
      data: {
        userId,
        type: "oauth",
        provider,
        issuer:
          provider === "oidc"
            ? (process.env.AUTH_OIDC_ISSUER ??
              "https://sso-proxy.lug.ustc.edu.cn/auth/oauth2")
            : createOAuthAccountIssuer(provider),
        providerAccountId,
      },
    });
    await db.verifiedEmail.create({ data: { userId, provider, email } });
  });
  return { provider, providerAccountId, email };
}

export const test = accountTest.extend<{
  profile: User;
  credentialPassword: string;
  credentialHash: string;
  credential: { email: string; password: string };
  ustcAccount: Awaited<ReturnType<typeof arrangeLinkedAccount>>;
  githubAccount: Awaited<ReturnType<typeof arrangeLinkedAccount>>;
  authorization: Authorization;
}>({
  profile: async ({ account, baseURL, isolatedWorker, run }, use) => {
    const image = absoluteTestUrl("/images/icon.png", baseURL);
    const profile = await run(() =>
      isolatedWorker.database.owner.user.update({
        where: { id: account.id },
        data: { image, profilePictures: [image] },
      }),
    );
    await use(profile);
  },
  // Hashing has no database dependency or continuation that can write after a
  // setup timeout. A dependent credential fixture starts only after it finishes.
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructured fixture dependencies.
  credentialPassword: async ({}, use) => {
    await use(`E2e-${crypto.randomUUID()}`);
  },
  credentialHash: async ({ credentialPassword }, use) => {
    await use(await hashPassword(credentialPassword));
  },
  credential: async (
    { account, credentialPassword, credentialHash, isolatedWorker, run },
    use,
  ) => {
    await run(() =>
      isolatedWorker.database.owner.account.create({
        data: {
          userId: account.id,
          provider: "credential",
          issuer: createLocalAccountIssuer("credential"),
          providerAccountId: account.id,
          password: credentialHash,
        },
      }),
    );
    await use({ email: account.email, password: credentialPassword });
  },
  ustcAccount: async ({ account, isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        arrangeLinkedAccount(isolatedWorker.database.owner, account.id, "oidc"),
      ),
    );
  },
  githubAccount: async ({ account, isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        arrangeLinkedAccount(
          isolatedWorker.database.owner,
          account.id,
          "github",
        ),
      ),
    );
  },
  authorization: async ({ account, baseURL, isolatedWorker, run }, use) => {
    const clientId = crypto.randomUUID();
    const clientSecret = `hidden-secret-${crypto.randomUUID()}`;
    const clientUri = "https://calendar.example";
    const redirectUri = absoluteTestUrl("/hidden-oauth-callback", baseURL);
    const name = `Private Calendar ${clientId.slice(0, 8)}`;
    const scopes = ["calendar:read", "profile"];
    const consent = await run(() =>
      isolatedWorker.database.owner.$transaction(async (tx) => {
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
    await use({
      clientId,
      clientSecret,
      clientUri,
      redirectUri,
      name,
      consentId: consent.id,
    });
  },
});

export async function expectSettingsPage(page: Page, path: string) {
  const response = await gotoAndWaitForReady(page, path, {
    browserHealth: {},
    expectMeaningfulContent: true,
    expectNoHorizontalOverflow: true,
    uiQuality: {},
  });
  expect(response?.ok()).toBe(true);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /设置|Settings/i, level: 1 }),
  ).toBeVisible();
}

export function storedProfile(db: TestPrismaClient, userId: string) {
  return db.user.findUnique({ where: { id: userId } });
}
