import { expect, type Page } from "@playwright/test";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "../../../../utils/calendar-protocol-lifecycle";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../../utils/oauth-usage";
import type { OAuthOwner } from "../../api/mcp/helpers";
import {
  issueAccessTokenForClient,
  registerPublicClient,
} from "../../api/mcp/helpers";

type Database = OAuthOwner["worker"]["database"]["owner"];
type RequestExpectation = readonly [
  method: string,
  path: string,
  statuses: readonly number[],
];

export function memberships(db: Database, userId: string) {
  return db.userSectionSubscription.findMany({
    where: { userId },
    orderBy: { sectionId: "asc" },
  });
}

/** B2 owns one subscription writer; other users and calendar sources stay fixed. */
export async function prepareContract(
  page: Page,
  owner: OAuthOwner,
  io: CalendarProtocol,
  userIds: string[],
  messages: number,
  feedTokenCreated = false,
) {
  const db = owner.worker.database.owner;
  const userId = userIds[0];
  const origin = owner.worker.origin;
  await io.observeCalendar(
    { id: userId },
    Array.from({ length: messages }, () => ({ type: "user", userId })),
  );
  const stable = () =>
    db.$transaction(async (tx) => ({
      users: (await tx.user.findMany({ orderBy: { id: "asc" } })).map(
        (user) => {
          if (!feedTokenCreated || user.id !== userId) return user;
          const {
            calendarFeedToken: _token,
            updatedAt: _updated,
            ...rest
          } = user;
          return rest;
        },
      ),
      foreignMemberships: await tx.userSectionSubscription.findMany({
        where: { userId: { not: userId } },
        orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
      }),
      todos: await tx.todo.findMany({ orderBy: { id: "asc" } }),
      youngSubscriptions: await tx.userYoungEventSubscription.findMany({
        orderBy: [{ userId: "asc" }, { youngId: "asc" }],
      }),
      youngEvents: await tx.youngEvent.findMany({
        orderBy: { youngId: "asc" },
      }),
      homework: await tx.homework.findMany({ orderBy: { id: "asc" } }),
      homeworkCompletions: await tx.homeworkCompletion.findMany({
        orderBy: [{ userId: "asc" }, { homeworkId: "asc" }],
      }),
      semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
      courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
      sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
      groups: await tx.scheduleGroup.findMany({ orderBy: { id: "asc" } }),
      schedules: await tx.schedule.findMany({ orderBy: { id: "asc" } }),
      exams: await tx.exam.findMany({ orderBy: { id: "asc" } }),
    }));
  const baseline = await stable();
  await page
    .context()
    .addCookies([(await owner.worker.createSession(userId)).cookie]);
  const sessions = await db.session.findMany({
    select: { id: true, userId: true },
  });
  expect(sessions).toEqual([{ id: expect.any(String), userId }]);
  const sessionId = sessions[0].id;
  let clientId: string | undefined;
  const scope = "workspace.subscription:write";
  const resource = `${origin}/api/mcp`;
  const windows: OAuthUsageWindow[] = [];
  return {
    async authorizeImports(name: string) {
      if (clientId)
        throw new Error("Subscription contract already has a client");
      clientId = await registerPublicClient(io.request, scope, owner);
      // DCR advertises the provider's public capabilities. Arrange this test's
      // exact client capability set separately from the narrower consent grant.
      await db.oAuthClient.update({
        where: { clientId },
        data: {
          scopes: [
            "workspace.subscription:read",
            "workspace.subscription:write",
          ],
        },
      });
      const { response, tokenBody } = await issueAccessTokenForClient(
        page,
        io.request,
        { clientId, scope, resource, owner },
      );
      expect(response.status()).toBe(200);
      expect(typeof tokenBody.access_token).toBe("string");
      expect(tokenBody.refresh_token).toBeUndefined();
      expect(tokenBody).not.toHaveProperty("id_token");
      const client = await io.mcp(
        { name, version: "1" },
        tokenBody.access_token as string,
      );
      return async (codes: string[], semesterId: number, error = false) => {
        const start = Date.now();
        const result = await client.callTool({
          name: "workspace_subscription_import",
          arguments: { codes, semesterId },
        });
        windows.push({
          start,
          end: Date.now(),
          operation: error ? "write error" : "write",
        });
        return result;
      };
    },
    checks(
      sectionIds: number[],
      requests: RequestExpectation[],
      importCalls = 0,
      usageErrors: 0 | 1 = 0,
    ): CalendarProtocolChecks {
      return {
        async verifyTransport({ effects, sdkRequests }) {
          for (const [method, path, statuses] of requests) {
            expect(
              effects.requests
                .filter(
                  ({ value }) => value.method === method && value.path === path,
                )
                .map(({ result }) => result)
                .sort(),
            ).toEqual([...statuses].sort());
          }
          for (const [method, path, status] of [
            ["POST", "/api/auth/oauth2/register", 201],
            ["GET", "/api/auth/oauth2/authorize", 302],
            ["POST", "/oauth/authorize", 200],
            ["POST", "/api/auth/oauth2/token", 200],
          ] as const) {
            expect(
              effects.requests
                .filter(
                  ({ value }) => value.method === method && value.path === path,
                )
                .map(({ result }) => result),
            ).toEqual(clientId ? [status] : []);
          }
          expect(
            sdkRequests
              .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
              .sort(),
          ).toEqual(
            clientId
              ? [
                  "GET stream",
                  "POST initialize",
                  "POST notifications/initialized",
                  ...Array.from(
                    { length: importCalls },
                    () => "POST tools/call",
                  ),
                ]
              : [],
          );
          expect(
            sdkRequests
              .filter(({ rpc }) => rpc === "tools/call")
              .map(({ tool }) => tool),
          ).toEqual(
            clientId
              ? Array.from(
                  { length: importCalls },
                  () => "workspace_subscription_import",
                )
              : [],
          );
        },
        async verifyState() {
          expect(
            (await memberships(db, userId)).map(
              ({ userId, sectionId, kind }) => ({ userId, sectionId, kind }),
            ),
          ).toEqual(
            [...sectionIds]
              .sort((a, b) => a - b)
              .map((sectionId) => ({ userId, sectionId, kind: "regular" })),
          );
          expect(await stable()).toEqual(baseline);
          expect(
            await db.user.findMany({
              orderBy: { id: "asc" },
              select: { id: true, calendarFeedToken: true },
            }),
          ).toEqual(
            [...userIds].sort().map((id) => ({
              id,
              calendarFeedToken:
                feedTokenCreated && id === userId ? expect.any(String) : null,
            })),
          );
          expect(
            await db.session.findMany({ select: { id: true, userId: true } }),
          ).toEqual(sessions);
          expect(owner.clientNames).toHaveLength(clientId ? 1 : 0);
          expect(
            await db.oAuthClient.findMany({
              select: {
                clientId: true,
                name: true,
                userId: true,
                scopes: true,
                redirectUris: true,
                grantTypes: true,
                responseTypes: true,
                tokenEndpointAuthMethod: true,
                applicationType: true,
              },
            }),
          ).toEqual(
            clientId
              ? [
                  {
                    clientId,
                    name: owner.clientNames[0],
                    userId: null,
                    scopes: [
                      "workspace.subscription:read",
                      "workspace.subscription:write",
                    ],
                    redirectUris: [`${origin}/e2e/oauth/callback`],
                    grantTypes: ["authorization_code"],
                    responseTypes: ["code"],
                    tokenEndpointAuthMethod: "none",
                    applicationType: "native",
                  },
                ]
              : [],
          );
          const consents = await db.oAuthConsent.findMany({
            select: {
              clientId: true,
              userId: true,
              grantId: true,
              scopes: true,
              resources: true,
              requestedUserInfoClaims: true,
            },
          });
          expect(consents).toEqual(
            clientId
              ? [
                  {
                    clientId,
                    userId,
                    grantId: expect.any(String),
                    scopes: [scope],
                    resources: [resource],
                    requestedUserInfoClaims: [],
                  },
                ]
              : [],
          );
          const grantId = consents[0]?.grantId;
          if (clientId)
            expect(grantId).toMatch(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
          const audits = () =>
            db.auditLog.findMany({
              select: {
                action: true,
                outcome: true,
                channel: true,
                userId: true,
                subjectUserId: true,
                targetId: true,
                targetType: true,
                oauthClientId: true,
                oauthGrantId: true,
                sessionId: true,
                metadata: true,
              },
            });
          await expect
            .poll(async () => (await audits()).length, { timeout: 15_000 })
            .toBe(clientId || feedTokenCreated ? 1 : 0);
          expect(await audits()).toEqual(
            clientId
              ? [
                  {
                    action: "oauth_authorization_grant",
                    outcome: "success",
                    channel: "web",
                    userId,
                    subjectUserId: userId,
                    targetId: clientId,
                    targetType: "oauth_client",
                    oauthClientId: clientId,
                    oauthGrantId: grantId,
                    sessionId,
                    metadata: {
                      changedFields: ["resources", "scopes", "userinfoClaims"],
                      resourceCount: 1,
                      scopeCount: 1,
                    },
                  },
                ]
              : feedTokenCreated
                ? [
                    {
                      action: "account_calendar_token_create",
                      outcome: "success",
                      channel: "system",
                      userId,
                      subjectUserId: userId,
                      targetId: userId,
                      targetType: "calendar_feed",
                      oauthClientId: null,
                      oauthGrantId: null,
                      sessionId: null,
                      metadata: null,
                    },
                  ]
                : [],
          );
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          const usage = await db.oAuthGrantUsageDaily.findMany({
            orderBy: { day: "asc" },
          });
          expectOAuthUsage(usage, {
            dimensions: {
              userId,
              clientId,
              grantId,
              feature: "workspace.subscription",
              channel: "mcp",
            },
            counts: clientId ? [0, importCalls, usageErrors] : [0, 0, 0],
            windows,
          });
        },
      };
    },
  };
}
