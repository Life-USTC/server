import type { Page } from "@playwright/test";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import {
  type IsolatedWorker,
  test as workerTest,
} from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";

async function setup(page: Page, worker: IsolatedWorker) {
  const db = worker.database.owner;
  const actor = await worker.createActor();
  const marker = `homework-audit-${crypto.randomUUID()}`;
  const scope = restWriteScope("community.section-homework");
  const { user, client, section } = await db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: actor.id },
      data: { name: "Private homework author" },
    });
    const client = await tx.oAuthClient.create({
      data: {
        name: marker,
        clientId: crypto.randomUUID(),
        clientSecret: crypto.randomUUID(),
        redirectUris: [`${worker.origin}/oauth-e2e/callback`],
        type: "public",
        tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
        disabled: false,
        scopes: [scope],
        grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
        requirePKCE: true,
        metadata: { source: "e2e_fixture" },
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: 1,
        code: "AUDIT.01",
        course: {
          create: { jwId: 1, code: "AUDIT", nameCn: "作业审计课程" },
        },
        semester: {
          create: { jwId: 1, code: "2026-1", nameCn: "作业审计学期" },
        },
      },
    });
    return { user, client, section };
  });
  await page.context().addCookies([actor.cookie]);
  const token = await authorizeDeviceBearer(
    page.request,
    worker.origin,
    client.clientId,
    scope,
  );
  const grant = await db.oAuthConsent.findUniqueOrThrow({
    where: { clientId_userId: { clientId: client.clientId, userId: user.id } },
  });
  const title = `${marker} private title`;
  const content = `${marker} private description`;
  return {
    db,
    user,
    client,
    grant,
    section,
    token,
    cookie: actor.cookie,
    title,
    content,
    headers: {
      authorization: `Bearer ${token}`,
      cookie: "",
      origin: worker.origin,
    },
    input: {
      sectionJwId: section.jwId,
      title,
      description: content,
      isMajor: true,
      requiresTeam: true,
    },
  };
}

export type HomeworkAudit = Awaited<ReturnType<typeof setup>>;
export const test = workerTest.extend<{ homework: HomeworkAudit }>({
  homework: async ({ page, isolatedWorker }, use) => {
    // Setup, real device grants and any installed DDL share this owned Worker.
    await use(await setup(page, isolatedWorker));
  },
});
