import { expect, type Page } from "@playwright/test";
import type {
  CalendarProtocol,
  CalendarProtocolChecks,
} from "../../../../utils/calendar-protocol-lifecycle";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../../utils/oauth-usage";
import { expectMcpToolCalls } from "../../../../utils/subscription-consumption";
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

/** Subscription mutations own their domain state and calendar effects.
 * OAuth client/consent contracts live in api/mcp/protocol-checks.ts. */
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
        async verifyTransport(observation) {
          const { effects } = observation;
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
          expectMcpToolCalls(
            observation,
            Array.from(
              { length: importCalls },
              () => "workspace_subscription_import",
            ),
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
          const grantId = clientId
            ? (
                await db.oAuthConsent.findUniqueOrThrow({
                  where: { clientId_userId: { clientId, userId } },
                  select: { grantId: true },
                })
              ).grantId
            : undefined;
          const audits = () =>
            db.auditLog.findMany({
              where: { action: { not: "oauth_authorization_grant" } },
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
            .toBe(feedTokenCreated ? 1 : 0);
          expect(await audits()).toEqual(
            feedTokenCreated
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
