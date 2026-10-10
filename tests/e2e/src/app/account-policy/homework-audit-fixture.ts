import { expect, type Page } from "@playwright/test";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restWriteScope } from "@/lib/oauth/scope-registry";
import { adminWriteChecks } from "../../../utils/admin-fixture";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { withCalendarProtocol } from "../../../utils/calendar-protocol-lifecycle";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";
import { expectOAuthUsage } from "../../../utils/oauth-usage";
import { test as workerTest } from "../../../utils/owned-worker";

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
type HomeworkAction = "create" | "update" | "delete";
export const test = workerTest.extend<{
  homeworkRun: (
    action: HomeworkAction,
    work: (fixture: HomeworkAudit) => Promise<void>,
  ) => Promise<void>;
}>({
  homeworkRun: async (
    { page, request: observer, playwright, isolatedWorker, run },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((action, work) =>
        workflow.run(() =>
          run(() => {
            const writes = {
              create: [
                ["POST", "/api/community/section-homeworks", 500],
                ["POST", "/api/community/section-homeworks", 201],
              ],
              update: [
                ["PATCH", /^\/api\/community\/section-homeworks\/[^/]+$/, 500],
                ["PATCH", /^\/api\/community\/section-homeworks\/[^/]+$/, 200],
              ],
              delete: [
                ["DELETE", /^\/api\/community\/section-homeworks\/[^/]+$/, 500],
                ["DELETE", /^\/api\/community\/section-homeworks\/[^/]+$/, 200],
              ],
            } as const;
            const checks = adminWriteChecks(
              [],
              [
                ["POST", "/api/auth/oauth2/device-authorization", 200],
                ["POST", "/oauth/device", 303],
                ["POST", "/api/auth/oauth2/token", 200],
                ...writes[action],
              ],
            );
            return withCalendarProtocol(
              {
                page,
                observer,
                isolatedWorker,
                runBody: workflow.body,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                verifyBrowserWrite: checks.verifyBrowserWrite,
              },
              async (io) => {
                // The device authorization requests and their bodies share this owner.
                const fixture = await setup(page, isolatedWorker);
                await io.observeCalendar(
                  fixture.user,
                  [{ type: "section", sectionId: fixture.section.id }],
                  { sectionId: fixture.section.id, calendar: "absent" },
                );
                const start = Date.now();
                await work(fixture);
                const end = Date.now();
                return {
                  verifyTransport: ({ effects, sdkRequests }) =>
                    checks.verifyTransport({ producer: effects, sdkRequests }),
                  async verifyState() {
                    const { db, user, client, grant, section } = fixture;
                    expect(
                      await db.auditLog.findMany({
                        where: {
                          action: {
                            in: [
                              "homework_create",
                              "homework_update",
                              "homework_delete",
                            ],
                          },
                        },
                        select: {
                          action: true,
                          outcome: true,
                          userId: true,
                          oauthClientId: true,
                          oauthGrantId: true,
                        },
                      }),
                    ).toEqual([
                      {
                        action: `homework_${action}`,
                        outcome: "success",
                        userId: user.id,
                        oauthClientId: client.clientId,
                        oauthGrantId: grant.grantId,
                      },
                    ]);
                    expect(
                      await db.oAuthConsent.findMany({
                        select: {
                          userId: true,
                          clientId: true,
                          grantId: true,
                          scopes: true,
                          resources: true,
                        },
                      }),
                    ).toEqual([
                      {
                        userId: user.id,
                        clientId: client.clientId,
                        grantId: grant.grantId,
                        scopes: ["community.section-homework:write"],
                        resources: [`${isolatedWorker.origin}/api/auth`],
                      },
                    ]);
                    expectOAuthUsage(
                      await db.oAuthGrantUsageDaily.findMany({
                        orderBy: { day: "asc" },
                      }),
                      {
                        dimensions: {
                          userId: user.id,
                          clientId: client.clientId,
                          grantId: grant.grantId,
                          feature: "community.section-homework",
                          channel: "rest",
                        },
                        counts: [0, 2, 1],
                        windows: [
                          { start, end, operation: "write error" },
                          { start, end, operation: "write" },
                        ],
                      },
                    );
                    expect(
                      await db.homework.count({
                        where: { sectionId: section.id },
                      }),
                    ).toBe(1);
                  },
                };
              },
            );
          }),
        ),
      );
    });
  },
});
