import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, type Page } from "@playwright/test";
import {
  issueAccessTokenForClient,
  type OAuthOwner,
  parseTextContent,
  registerPublicClient,
} from "../src/app/api/mcp/helpers";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "./calendar-protocol-lifecycle";
import { expectOAuthUsage, type OAuthUsageWindow } from "./oauth-usage";
import type { PrivateCalendar } from "./private-calendar-fixture";

type Database = OAuthOwner["worker"]["database"]["owner"];

export function readCalendarState(db: Database) {
  return db.$transaction(async (tx) => ({
    users: await tx.user.findMany({ orderBy: { id: "asc" } }),
    subscriptions: await tx.userSectionSubscription.findMany({
      orderBy: [{ userId: "asc" }, { sectionId: "asc" }],
    }),
    todos: await tx.todo.findMany({ orderBy: { id: "asc" } }),
    youngSubscriptions: await tx.userYoungEventSubscription.findMany({
      orderBy: [{ userId: "asc" }, { youngId: "asc" }],
    }),
    youngEvents: await tx.youngEvent.findMany({ orderBy: { youngId: "asc" } }),
    homework: await tx.homework.findMany({
      orderBy: { id: "asc" },
      include: { description: true },
    }),
    completions: await tx.homeworkCompletion.findMany({
      orderBy: [{ userId: "asc" }, { homeworkId: "asc" }],
    }),
    semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
    courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
    sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
    groups: await tx.scheduleGroup.findMany({ orderBy: { id: "asc" } }),
    schedules: await tx.schedule.findMany({ orderBy: { id: "asc" } }),
    exams: await tx.exam.findMany({ orderBy: { id: "asc" } }),
  }));
}

/** Domain observations inside the existing protocol owner; expectations are
 * supplied by each case, independently of tool output and production mappings. */
export async function prepareCalendarRead(
  page: Page,
  owner: OAuthOwner,
  io: CalendarProtocol,
  fixture: PrivateCalendar,
  {
    name,
    scopes,
    tools,
    usage,
    feedTokenCreated = false,
  }: {
    name: string;
    scopes: string[];
    tools: readonly (readonly [name: string, feature: string])[];
    usage: readonly (readonly [feature: string, reads: number])[];
    feedTokenCreated?: boolean;
  },
) {
  const db = owner.worker.database.owner;
  const origin = owner.worker.origin;
  const userId = fixture.users[0].id;
  const resource = `${origin}/api/mcp`;
  await io.observeCalendar({ id: userId }, []);
  await page
    .context()
    .addCookies([(await owner.worker.createSession(userId)).cookie]);
  const sessions = await db.session.findMany({
    select: { id: true, userId: true },
  });
  expect(sessions).toEqual([{ id: expect.any(String), userId }]);
  const sessionId = sessions[0].id;
  let clientId: string | undefined;
  let client: Client | undefined;
  const windows: (OAuthUsageWindow & { feature: string })[] = [];
  async function callTool(input: Parameters<Client["callTool"]>[0]) {
    if (!client) throw new Error("Calendar read authorization is required");
    const planned = tools[windows.length];
    expect(input.name).toBe(planned?.[0]);
    const start = Date.now();
    const result = await client.callTool(input);
    windows.push({
      start,
      end: Date.now(),
      operation: "read",
      feature: planned[1],
    });
    return result;
  }
  return {
    async authorize() {
      if (clientId) throw new Error("Calendar read client already exists");
      clientId = await registerPublicClient(
        io.request,
        scopes.join(" "),
        owner,
      );
      // Arrange client capabilities separately from the real consent grant.
      await db.oAuthClient.update({ where: { clientId }, data: { scopes } });
      const { response, tokenBody } = await issueAccessTokenForClient(
        page,
        io.request,
        {
          clientId,
          scope: scopes.join(" "),
          resource,
          owner,
        },
      );
      expect(response.status()).toBe(200);
      expect(typeof tokenBody.access_token).toBe("string");
      expect(tokenBody.refresh_token).toBeUndefined();
      expect(tokenBody).not.toHaveProperty("id_token");
      client = await io.mcp(
        { name, version: "1" },
        tokenBody.access_token as string,
      );
    },
    callTool,
    async call<Result>(name: string, args: Record<string, unknown> = {}) {
      const response = await callTool({ name, arguments: args });
      expect(response.isError).not.toBe(true);
      return parseTextContent(response) as Result;
    },
    checks(
      expectedState: Awaited<ReturnType<typeof readCalendarState>>,
    ): CalendarProtocolChecks {
      return {
        async verifyTransport({ effects, sdkRequests }) {
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
            ).toEqual([status]);
          }
          expect(
            sdkRequests
              .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
              .sort(),
          ).toEqual([
            "GET stream",
            "POST initialize",
            "POST notifications/initialized",
            ...tools.map(() => "POST tools/call"),
          ]);
          expect(
            sdkRequests
              .filter(({ rpc }) => rpc === "tools/call")
              .map(({ tool }) => tool),
          ).toEqual(tools.map(([name]) => name));
        },
        async verifyState() {
          const actual = await readCalendarState(db);
          const observedAt = Date.now();
          if (feedTokenCreated) {
            const actor = actual.users.find(({ id }) => id === userId);
            const prior = expectedState.users.find(({ id }) => id === userId);
            if (!actor || !prior)
              throw new Error("Missing calendar feed owner");
            expect(actor.calendarFeedToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
            expect(actor.updatedAt.getTime()).toBeGreaterThanOrEqual(
              prior.updatedAt.getTime(),
            );
            expect(actor.updatedAt.getTime()).toBeLessThanOrEqual(observedAt);
          }
          const expected = {
            ...structuredClone(expectedState),
            users: expectedState.users.map((user) =>
              feedTokenCreated && user.id === userId
                ? {
                    ...user,
                    calendarFeedToken: expect.any(String),
                    updatedAt: expect.any(Date),
                  }
                : user,
            ),
          };
          expect(actual).toEqual(expected);
          expect(
            await db.user.findMany({
              orderBy: { id: "asc" },
              select: { id: true, calendarFeedToken: true },
            }),
          ).toEqual(
            fixture.users
              .map(({ id }) => ({
                id,
                calendarFeedToken:
                  feedTokenCreated && id === userId ? expect.any(String) : null,
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          );
          expect(
            await db.session.findMany({ select: { id: true, userId: true } }),
          ).toEqual(sessions);
          expect(owner.clientNames).toHaveLength(1);
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
          ).toEqual([
            {
              clientId,
              name: owner.clientNames[0],
              userId: null,
              scopes,
              redirectUris: [`${origin}/e2e/oauth/callback`],
              grantTypes: ["authorization_code"],
              responseTypes: ["code"],
              tokenEndpointAuthMethod: "none",
              applicationType: "native",
            },
          ]);
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
          expect(consents).toEqual([
            {
              clientId,
              userId,
              grantId: expect.any(String),
              scopes,
              resources: [resource],
              requestedUserInfoClaims: [],
            },
          ]);
          const grantId = consents[0].grantId;
          expect(grantId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          const audits = () =>
            db.auditLog.findMany({
              orderBy: { action: "asc" },
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
            .toBe(feedTokenCreated ? 2 : 1);
          expect(await audits()).toEqual([
            ...(feedTokenCreated
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
              : []),
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
                scopeCount: scopes.length,
              },
            },
          ]);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          const rows = await db.oAuthGrantUsageDaily.findMany({
            orderBy: { day: "asc" },
          });
          for (const row of rows)
            expect(usage.map(([feature]) => feature)).toContain(row.feature);
          expect(windows).toHaveLength(tools.length);
          for (const [feature, reads] of usage)
            expectOAuthUsage(
              rows.filter((row) => row.feature === feature),
              {
                dimensions: {
                  userId,
                  clientId,
                  grantId,
                  feature,
                  channel: "mcp",
                },
                counts: [reads, 0, 0],
                windows: windows.filter((window) => window.feature === feature),
              },
            );
        },
      };
    },
  };
}
