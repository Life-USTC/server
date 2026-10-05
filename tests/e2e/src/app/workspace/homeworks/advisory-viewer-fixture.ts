import { isDeepStrictEqual } from "node:util";
import { expect } from "@playwright/test";
import type { Session } from "../../../../../../src/generated/prisma-node/client";
import type {
  CalendarBrowserWriteVerifier,
  CalendarProtocol,
  CalendarProtocolChecks,
} from "../../../../utils/calendar-protocol-lifecycle";
import { readCalendarState } from "../../../../utils/calendar-read-observation";
import {
  type CommunityFlow,
  withCommunityFlow,
} from "../../../../utils/community-flow";
import type { IsolatedWorker } from "../../../../utils/isolated-worker";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../../utils/oauth-usage";
import { arrangeSection, facts } from "../../api/mcp/_data";
import { test as oauthTest } from "../../api/mcp/_fixture";
import type { OAuthOwner } from "../../api/mcp/helpers";
import { REGISTERED_CLIENT_CAPABILITIES } from "../../api/mcp/protocol-checks";

export type Target = {
  worker: IsolatedWorker;
  ownerId: string;
  sectionId: number;
  sectionJwId: number;
};
export const description = "Just do the exercises. Submit however you prefer.";
const title = (surface: string) =>
  `${facts.course.nameCn} ${facts.course.code} 第一章作业 ${surface}`;
type Database = IsolatedWorker["database"]["owner"];

async function relatedState(db: Database) {
  return db.$transaction(async (tx) => ({
    accounts: await tx.account.findMany({ orderBy: { id: "asc" } }),
    teachers: await tx.teacher.findMany({ orderBy: { id: "asc" } }),
    comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
    pins: await tx.workspaceLinkPin.findMany({ orderBy: { id: "asc" } }),
    preferences: await tx.busUserPreference.findMany({
      orderBy: { userId: "asc" },
    }),
  }));
}

function expectSessionRefresh(
  actual: Session[],
  before: Session[],
  start: number,
  end: number,
) {
  expect(actual).toHaveLength(1);
  expect(before).toHaveLength(1);
  const session = actual[0];
  const issuedAt = session.expires.getTime() - 30 * 86_400_000;
  expect(issuedAt).toBeGreaterThanOrEqual(start);
  expect(issuedAt).toBeLessThanOrEqual(end);
  expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(issuedAt);
  expect(session.updatedAt.getTime()).toBeLessThanOrEqual(end);
  expect(session.expires.getTime()).toBeGreaterThan(
    before[0].expires.getTime(),
  );
  expect(actual).toEqual([
    { ...before[0], expires: expect.any(Date), updatedAt: expect.any(Date) },
  ]);
}

export const test = oauthTest.extend<{
  target: Target;
  teachingTarget: Target & { title: string };
  teachingFlow: CommunityFlow;
}>({
  target: async ({ oauth, run }, use) => {
    const section = await run(() =>
      oauth.worker.database.owner.$transaction(async (db) => {
        const section = await arrangeSection(db);
        await db.userSectionSubscription.create({
          data: { userId: oauth.user.id, sectionId: section.id },
        });
        return section;
      }),
    );
    await use({
      worker: oauth.worker,
      ownerId: oauth.user.id,
      sectionId: section.id,
      sectionJwId: section.jwId,
    });
  },
  teachingTarget: async ({ isolatedWorker, run }, use) => {
    const ownerId = crypto.randomUUID();
    const title = `TA homework ${crypto.randomUUID()}`;
    const section = await run(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
        await db.user.create({
          data: {
            id: ownerId,
            name: "Private teaching assistant",
            username: `ta${ownerId.replaceAll("-", "").slice(0, 14)}`,
            email: `${ownerId}@example.test`,
          },
        });
        const section = await arrangeSection(db);
        await db.userSectionSubscription.create({
          data: {
            userId: ownerId,
            sectionId: section.id,
            kind: "teaching_assistant",
          },
        });
        await db.homework.create({
          data: {
            sectionId: section.id,
            title,
            createdById: ownerId,
            submissionDueAt: new Date("2099-01-01T00:00:00Z"),
          },
        });
        return section;
      }),
    );
    await use({
      worker: isolatedWorker,
      ownerId,
      sectionId: section.id,
      sectionJwId: section.jwId,
      title,
    });
  },
  teachingFlow: async (
    { page, browser, request: observer, isolatedWorker, teachingTarget, run },
    use,
  ) => {
    await run(() =>
      withCommunityFlow(
        {
          page,
          browser,
          observer,
          isolatedWorker,
          account: { id: teachingTarget.ownerId },
        },
        async (flow) => {
          await use({
            ...flow,
            run: (work) => {
              const db = isolatedWorker.database.owner;
              let before: Awaited<ReturnType<typeof readCalendarState>>;
              let related: Awaited<ReturnType<typeof relatedState>>;
              let sessions: Session[];
              let start: number;
              return flow.run(
                async () => {
                  before = await readCalendarState(db);
                  related = await relatedState(db);
                  await page
                    .context()
                    .addCookies([
                      (
                        await isolatedWorker.createSession(
                          teachingTarget.ownerId,
                        )
                      ).cookie,
                    ]);
                  sessions = await db.session.findMany();
                  start = Date.now();
                  await work();
                },
                {},
                {
                  async verifyTransport({ producer, sdkRequests }) {
                    expect(sdkRequests).toEqual([]);
                    expect(
                      producer.requests
                        .filter(
                          ({ value }) =>
                            !["GET", "HEAD"].includes(value.method),
                        )
                        .map(({ value, result }) => ({
                          method: value.method,
                          path: value.path,
                          status: result,
                        })),
                    ).toEqual([
                      {
                        method: "POST",
                        path: "/api/account/preferences",
                        status: 200,
                      },
                      {
                        method: "POST",
                        path: "/api/account/preferences",
                        status: 200,
                      },
                    ]);
                  },
                  async verifyState() {
                    expect(await readCalendarState(db)).toEqual(before);
                    expect(await relatedState(db)).toEqual(related);
                    expectSessionRefresh(
                      await db.session.findMany(),
                      sessions,
                      start,
                      Date.now(),
                    );
                    expect(await db.auditLog.findMany()).toEqual([]);
                    expect(await db.oAuthClient.count()).toBe(0);
                    expect(await db.oAuthConsent.count()).toBe(0);
                    expect(await db.oAuthAccessToken.count()).toBe(0);
                    expect(await db.oAuthRefreshToken.count()).toBe(0);
                    expect(await db.deviceCode.count()).toBe(0);
                    expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
                  },
                },
              );
            },
          });
        },
      ),
    );
  },
});

/** Observations only: actual browser/protocol work remains in calendarProtocolRun. */
export function observeAdvisory(
  target: Target,
  owner: OAuthOwner,
  method: "Web" | "REST" | "GraphQL" | "MCP",
) {
  const db = target.worker.database.owner;
  const origin = target.worker.origin;
  let baseline: Awaited<ReturnType<typeof readCalendarState>>;
  let related: Awaited<ReturnType<typeof relatedState>>;
  let sessions: Session[];
  let start: number;
  let clientId: string | undefined;
  const windows: OAuthUsageWindow[] = [];
  const browserWrites: { method: string; path: string; status: number }[] = [];
  let sectionHomeworkId: string | undefined;
  const verifyBrowserWrite: CalendarBrowserWriteVerifier = async (
    response,
    incoming,
  ) => {
    const index = browserWrites.length;
    const path = new URL(incoming.url()).pathname;
    const expected = [
      { method: "POST", path: "/api/community/section-homeworks", status: 201 },
      {
        method: "PATCH",
        path: `/api/community/section-homeworks/${sectionHomeworkId}`,
        status: 200,
      },
      { method: "POST", path: "/workspace/homeworks", status: 200 },
    ];
    const actual = {
      method: incoming.method(),
      path,
      status: response.status(),
    };
    expect(actual).toEqual(expected[index]);
    browserWrites.push(actual);
    const body = await response.json();
    const suffix = ["section-create", "section-edit", "workspace"][index];
    if (index === 0) {
      expect(body).toMatchObject({
        id: expect.any(String),
        homework: { title: title(suffix) },
      });
      sectionHomeworkId = body.id;
    } else if (index === 1) {
      expect(body).toMatchObject({
        success: true,
        homework: { id: sectionHomeworkId, title: title(suffix) },
      });
    } else {
      expect(body).toEqual({
        type: "redirect",
        status: 303,
        location: "/workspace/homeworks",
      });
    }
    const persisted = await db.homework.findFirstOrThrow({
      where: { sectionId: target.sectionId, title: title(suffix) },
      include: { description: true },
    });
    expect(persisted).toMatchObject({
      createdById: target.ownerId,
      updatedById: target.ownerId,
      description: { content: description },
    });
  };
  return {
    verifyBrowserWrite,
    async prepare(io: CalendarProtocol) {
      await io.observeCalendar(
        { id: target.ownerId },
        Array.from({ length: method === "Web" ? 3 : 2 }, () => ({
          type: "section" as const,
          sectionId: target.sectionId,
        })),
        { sectionId: target.sectionId },
      );
      baseline = await readCalendarState(db);
      expect(baseline.homework).toEqual([]);
      related = await relatedState(db);
      sessions = await db.session.findMany();
      expect(sessions).toEqual([
        expect.objectContaining({ userId: target.ownerId }),
      ]);
      start = Date.now();
    },
    authorized(id: string) {
      clientId = id;
    },
    async mcpWrite<T>(work: () => Promise<T>) {
      const started = Date.now();
      const result = await work();
      windows.push({ start: started, end: Date.now(), operation: "write" });
      return result;
    },
    checks(): CalendarProtocolChecks {
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(effects.purges).toEqual([]);
          expect(browserWrites).toEqual(
            method === "Web"
              ? [
                  {
                    method: "POST",
                    path: "/api/community/section-homeworks",
                    status: 201,
                  },
                  {
                    method: "PATCH",
                    path: `/api/community/section-homeworks/${sectionHomeworkId}`,
                    status: 200,
                  },
                  { method: "POST", path: "/workspace/homeworks", status: 200 },
                ]
              : [],
          );
          for (const [requestMethod, path, statuses] of [
            ["POST", "/api/account/preferences", [200]],
            [
              "POST",
              "/api/community/section-homeworks",
              method === "Web" || method === "REST" ? [201] : [],
            ],
            ["POST", "/workspace/homeworks", method === "Web" ? [200] : []],
            ["POST", "/api/graphql", method === "GraphQL" ? [200, 200] : []],
            [
              "POST",
              "/api/auth/oauth2/register",
              method === "MCP" ? [201] : [],
            ],
            [
              "GET",
              "/api/auth/oauth2/authorize",
              method === "MCP" ? [302] : [],
            ],
            ["POST", "/oauth/authorize", method === "MCP" ? [200] : []],
            ["POST", "/api/auth/oauth2/token", method === "MCP" ? [200] : []],
          ] as const) {
            expect(
              effects.requests
                .filter(
                  ({ value }) =>
                    value.method === requestMethod && value.path === path,
                )
                .map(({ result }) => result),
            ).toEqual(statuses);
          }
          const patches = effects.requests.filter(
            ({ value }) => value.method === "PATCH",
          );
          expect(patches.map(({ result }) => result)).toEqual(
            method === "Web" || method === "REST" ? [200] : [],
          );
          if (method === "Web")
            expect(patches[0].value.path).toBe(
              `/api/community/section-homeworks/${sectionHomeworkId}`,
            );
          if (method === "REST")
            expect(patches[0].value.path).toMatch(
              /^\/api\/community\/section-homeworks\/[^/]+$/,
            );
          expect(
            effects.requests.filter(
              ({ value }) =>
                !["GET", "HEAD"].includes(value.method) &&
                value.path !== "/api/mcp",
            ),
          ).toHaveLength(method === "Web" || method === "MCP" ? 4 : 3);
          expect(
            sdkRequests
              .map(({ method, rpc }) => `${method} ${rpc ?? "stream"}`)
              .sort(),
          ).toEqual(
            method === "MCP"
              ? [
                  "GET stream",
                  "POST initialize",
                  "POST notifications/initialized",
                  "POST tools/call",
                  "POST tools/call",
                ]
              : [],
          );
          expect(
            sdkRequests
              .filter(({ rpc }) => rpc === "tools/call")
              .map(({ tool }) => tool),
          ).toEqual(
            method === "MCP"
              ? [
                  "community_section_homework_create",
                  "community_section_homework_update",
                ]
              : [],
          );
        },
        async verifyState() {
          const state = await readCalendarState(db);
          const end = Date.now();
          expect({ ...state, homework: [] }).toEqual(baseline);
          expect(await relatedState(db)).toEqual(related);
          expectSessionRefresh(
            await db.session.findMany(),
            sessions,
            start,
            end,
          );
          const rows = await db.homework.findMany({
            orderBy: { title: "asc" },
            include: { description: { include: { edits: true } } },
          });
          const suffixes =
            method === "Web"
              ? ["section-edit", "workspace"]
              : [`${method.toLowerCase()}-edit`];
          expect(rows).toHaveLength(suffixes.length);
          expect(rows.map((row) => row.title)).toEqual(suffixes.map(title));
          for (const [index, row] of rows.entries()) {
            const ui = ["section-edit", "workspace"].includes(suffixes[index]);
            for (const time of [
              row.createdAt,
              row.updatedAt,
              row.description?.createdAt,
              row.description?.updatedAt,
              row.description?.lastEditedAt,
              row.description?.edits[0]?.createdAt,
            ]) {
              expect(time).toBeInstanceOf(Date);
              expect(time?.getTime()).toBeGreaterThanOrEqual(start);
              expect(time?.getTime()).toBeLessThanOrEqual(end);
            }
            if (ui) {
              const day = (time: number) =>
                new Date(time + 8 * 3_600_000).toISOString().slice(0, 10);
              expect([day(start), day(end)]).toContain(
                day(row.publishedAt?.getTime() ?? 0),
              );
              expect(row.publishedAt?.toISOString()).toMatch(
                /T16:00:00\.000Z$/,
              );
              expect(row.submissionStartAt?.getTime()).toBeGreaterThanOrEqual(
                Math.floor(start / 60_000) * 60_000,
              );
              expect(row.submissionStartAt?.getTime()).toBeLessThanOrEqual(end);
            }
            expect(row).toEqual({
              id: expect.any(String),
              title: title(suffixes[index]),
              sectionId: target.sectionId,
              isMajor: false,
              requiresTeam: false,
              publishedAt: ui ? expect.any(Date) : null,
              submissionStartAt: ui ? expect.any(Date) : null,
              submissionDueAt: null,
              createdAt: expect.any(Date),
              updatedAt: expect.any(Date),
              deletedAt: null,
              createdById: target.ownerId,
              updatedById: target.ownerId,
              deletedById: null,
              description: {
                id: expect.any(String),
                content: description,
                createdAt: expect.any(Date),
                updatedAt: expect.any(Date),
                lastEditedAt: expect.any(Date),
                lastEditedById: target.ownerId,
                homeworkId: row.id,
                courseId: null,
                sectionId: null,
                teacherId: null,
                edits: [
                  {
                    id: expect.any(String),
                    descriptionId: row.description?.id,
                    editorId: target.ownerId,
                    previousContent: null,
                    nextContent: description,
                    createdAt: expect.any(Date),
                  },
                ],
              },
            });
          }
          expect(await db.description.count()).toBe(suffixes.length);
          expect(await db.descriptionEdit.count()).toBe(suffixes.length);
          let grantId: string | undefined;
          if (method === "MCP") {
            expect(owner.clientNames).toHaveLength(1);
            expect(clientId).toBeDefined();
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
                scopes: REGISTERED_CLIENT_CAPABILITIES,
                redirectUris: [`${origin}/e2e/oauth/callback`],
                grantTypes: ["authorization_code"],
                responseTypes: ["code"],
                tokenEndpointAuthMethod: "none",
                applicationType: "native",
              },
            ]);
            const grants = await db.oAuthConsent.findMany({
              select: {
                clientId: true,
                userId: true,
                grantId: true,
                scopes: true,
                resources: true,
                requestedUserInfoClaims: true,
              },
            });
            expect(grants).toEqual([
              {
                clientId,
                userId: target.ownerId,
                grantId: expect.any(String),
                scopes: ["community.section-homework:write"],
                resources: [`${origin}/api/mcp`],
                requestedUserInfoClaims: [],
              },
            ]);
            grantId = grants[0].grantId;
            expect(grantId).toMatch(/^[0-9a-f-]{36}$/i);
            const usage = await db.oAuthGrantUsageDaily.findMany({
              orderBy: { day: "asc" },
            });
            expectOAuthUsage(usage, {
              dimensions: {
                userId: target.ownerId,
                clientId,
                grantId,
                feature: "community.section-homework",
                channel: "mcp",
              },
              counts: [0, 2, 0],
              windows,
            });
          } else {
            expect(owner.clientNames).toEqual([]);
            expect(clientId).toBeUndefined();
            expect(await db.oAuthClient.count()).toBe(0);
            expect(await db.oAuthConsent.count()).toBe(0);
            expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
          }
          expect(await db.oAuthAccessToken.count()).toBe(0);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.deviceCode.count()).toBe(0);
          const createFields = [
            "title",
            "isMajor",
            "requiresTeam",
            "publishedAt",
            "submissionStartAt",
            "submissionDueAt",
            "description",
          ];
          const expectedAudits = rows.flatMap((row, index) => {
            const suffix = suffixes[index];
            const channel =
              suffix === "workspace"
                ? "web"
                : suffix === "graphql-edit"
                  ? "graphql"
                  : suffix === "mcp-edit"
                    ? "mcp"
                    : "rest";
            const attribution = {
              outcome: "success",
              channel,
              userId: target.ownerId,
              subjectUserId: target.ownerId,
              targetId: row.id,
              targetType: "homework",
              sessionId: suffix === "workspace" ? null : sessions[0].id,
              oauthClientId: suffix === "mcp-edit" ? clientId : null,
              oauthGrantId: suffix === "mcp-edit" ? grantId : null,
            };
            return [
              {
                ...attribution,
                action: "homework_create",
                metadata: {
                  sectionId: target.sectionId,
                  changedFields: createFields,
                },
              },
              ...(suffix === "workspace"
                ? []
                : [
                    {
                      ...attribution,
                      action: "homework_update",
                      metadata: {
                        sectionId: target.sectionId,
                        changedFields:
                          suffix === "section-edit"
                            ? [
                                "description",
                                "title",
                                "isMajor",
                                "requiresTeam",
                                "publishedAt",
                                "submissionStartAt",
                                "submissionDueAt",
                              ]
                            : ["description", "title"],
                      },
                    },
                  ]),
            ];
          });
          const expected = [
            ...expectedAudits,
            ...(method === "MCP"
              ? [
                  {
                    action: "oauth_authorization_grant",
                    outcome: "success",
                    channel: "web",
                    userId: target.ownerId,
                    subjectUserId: target.ownerId,
                    targetId: clientId,
                    targetType: "oauth_client",
                    sessionId: sessions[0].id,
                    oauthClientId: clientId,
                    oauthGrantId: grantId,
                    metadata: {
                      changedFields: ["resources", "scopes", "userinfoClaims"],
                      resourceCount: 1,
                      scopeCount: 1,
                    },
                  },
                ]
              : []),
          ];
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
                sessionId: true,
                oauthClientId: true,
                oauthGrantId: true,
                metadata: true,
              },
            });
          await expect
            .poll(async () => (await audits()).length)
            .toBe(expected.length);
          const remaining = await audits();
          for (const row of expected) {
            const index = remaining.findIndex((actual) =>
              isDeepStrictEqual(actual, row),
            );
            expect(index, JSON.stringify(row)).toBeGreaterThanOrEqual(0);
            remaining.splice(index, 1);
          }
          expect(remaining).toEqual([]);
        },
      };
    },
  };
}
