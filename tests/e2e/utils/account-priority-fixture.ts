import { createOAuthAccountIssuer } from "@better-auth/core/db";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import { DEV_SEED } from "./dev-seed";
import { generateToken } from "./e2e-db/core";
import { test as workerTest } from "./owned-worker";
import { withSettledPageWrites } from "./settled-page-writes";

/** Every account, grant and welcome catalog row commits together in this test's database. */
async function createAccountPriorityFixture(
  owner: TestPrismaClient,
  origin: string,
) {
  return owner.$transaction(async (db) => {
    const marker = crypto.randomUUID();
    const now = new Date(Math.floor(Date.now() / 60000) * 60000);
    const user = await db.user.create({
      data: {
        name: "Priority account",
        username: `pf${marker.replaceAll("-", "").slice(0, 12)}`,
        email: `${marker}@example.test`,
        isAdmin: true,
        image: "/images/priority-current.svg",
        profilePictures: [
          "/images/priority-current.svg",
          "/images/priority-alternate.svg",
        ],
      },
    });

    const authorization = {
      name: "Priority Calendar",
      scopes: ["profile", "workspace.calendar:read"],
      clientId: generateToken(16),
      clientSecret: `hidden-secret-${generateToken(12)}`,
      redirectUri: `${origin}/hidden-oauth-callback`,
      clientUri: "https://calendar.example",
    };
    await db.oAuthClient.create({
      data: {
        clientId: authorization.clientId,
        clientSecret: authorization.clientSecret,
        name: authorization.name,
        redirectUris: [authorization.redirectUri],
        scopes: authorization.scopes,
        uri: authorization.clientUri,
      },
    });
    const authorizationConsent = await db.oAuthConsent.create({
      data: {
        clientId: authorization.clientId,
        scopes: authorization.scopes,
        userId: user.id,
      },
      select: { id: true },
    });
    const client = await db.oAuthClient.create({
      data: {
        name: "Priority Device",
        clientId: `https://priority-app.example.test/${marker}/client.json`,
        scopes: ["openid", "profile"],
        tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
        grantTypes: ["authorization_code", OAUTH_DEVICE_CODE_GRANT_TYPE],
        redirectUris: ["https://priority-callback.example.test/return"],
        clientSecret: generateToken(24),
        type: "public",
        disabled: false,
        responseTypes: ["code"],
        requirePKCE: true,
        metadata: { source: "e2e_fixture" },
      },
      select: {
        id: true,
        clientId: true,
        name: true,
        tokenEndpointAuthMethod: true,
        redirectUris: true,
        scopes: true,
      },
    });
    const account = {
      provider: "github",
      providerAccountId: `priority-${marker}`,
      email: `github-${Date.now()}-${generateToken(6)}@example.test`,
    };
    await db.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: account.provider,
        issuer: createOAuthAccountIssuer("github"),
        providerAccountId: account.providerAccountId,
      },
    });
    await db.verifiedEmail.create({
      data: {
        userId: user.id,
        provider: account.provider,
        email: account.email,
      },
    });
    await db.oAuthClient.update({
      where: { clientId: authorization.clientId },
      data: { disabled: true },
    });
    await db.oAuthClient.update({
      where: { clientId: client.clientId },
      data: { uri: "https://priority-app.example.test" },
    });
    const consent = await db.oAuthConsent.update({
      where: { id: authorizationConsent.id },
      data: { updatedAt: now },
    });
    await db.oAuthGrantUsageDaily.create({
      data: {
        userId: user.id,
        clientId: authorization.clientId,
        grantId: consent.grantId,
        grantKey: `grant:${consent.grantId}`,
        day: new Date(
          `${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(now)}T00:00:00Z`,
        ),
        feature: "workspace.calendar",
        channel: "mcp",
        readCount: 7,
        writeCount: 3,
        errorCount: 2,
        lastUsedAt: now,
      },
    });
    const event = await db.auditLog.create({
      data: {
        action: "account_profile_update",
        outcome: "success",
        channel: "web",
        userId: user.id,
        subjectUserId: user.id,
        oauthClientId: authorization.clientId,
        createdAt: now,
        ipAddress: "203.0.113.42",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
      },
    });
    const passkey = await db.passkey.create({
      data: {
        userId: user.id,
        name: "Priority laptop",
        publicKey: "priority-fixture-public-key",
        credentialID: marker,
        counter: 0,
        deviceType: "singleDevice",
        backedUp: false,
        createdAt: now,
      },
    });

    const semester = await db.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
      },
    });
    const course = await db.course.create({
      data: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
        nameCn: DEV_SEED.course.nameCn,
        nameEn: DEV_SEED.course.nameEn,
      },
    });
    const teacher = await db.teacher.create({
      data: {
        jwId: DEV_SEED.teacher.jwId,
        code: DEV_SEED.teacher.code,
        nameCn: DEV_SEED.teacher.nameCn,
        nameEn: DEV_SEED.teacher.nameEn,
      },
    });
    await db.section.create({
      data: {
        jwId: DEV_SEED.section.jwId,
        code: DEV_SEED.section.code,
        courseId: course.id,
        semesterId: semester.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    return {
      user,
      authorization: { ...authorization, consentId: authorizationConsent.id },
      client,
      account,
      now,
      event,
      passkey,
      origin,
    };
  });
}
export type AccountPriorityFixture = Awaited<
  ReturnType<typeof createAccountPriorityFixture>
>;

export const test = workerTest.extend<{
  accountPriority: AccountPriorityFixture;
  accountPriorityDb: <T>(
    work: (db: TestPrismaClient) => Promise<T>,
  ) => Promise<T>;
  accountPriorityRun: (work: () => Promise<void>) => Promise<void>;
}>({
  accountPriority: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        createAccountPriorityFixture(
          isolatedWorker.database.owner,
          isolatedWorker.origin,
        ),
      ),
    );
  },
  accountPriorityDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  accountPriorityRun: async (
    { page, isolatedWorker, accountPriority: _account, run },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withSettledPageWrites(
              page,
              (url) => url.origin === isolatedWorker.origin,
              () => workflow.body(work),
            ),
          ),
        ),
      );
    });
  },
});
