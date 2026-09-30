import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import {
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { restReadScope } from "@/lib/oauth/scope-registry";
import type { Session } from "../../../../../src/generated/prisma-node/client";
import { readCalendarState } from "../../../utils/calendar-read-observation";
import {
  type CommunityFlow,
  withCommunityFlow,
} from "../../../utils/community-flow";
import { DEV_SEED } from "../../../utils/dev-seed";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import {
  expectOAuthUsage,
  type OAuthUsageWindow,
} from "../../../utils/oauth-usage";
import { test as ownedTest } from "../../../utils/owned-worker";

type Plan = {
  incomplete?: boolean;
  device?: boolean;
  debug?: boolean;
  feedToken?: boolean;
  sessions: { user: number; deleted?: boolean }[];
};
type Database = IsolatedWorker["database"]["owner"];

/** The whole catalog and its viewers are prerequisites of one private case. */
async function arrange(
  db: Database,
  origin: string,
  plan: Plan,
  actorId: string,
) {
  const password = plan.debug ? await hashPassword("dev-debug-password") : null;
  return db.$transaction(async (tx) => {
    const semester = await tx.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    const course = await tx.course.create({
      data: {
        jwId: DEV_SEED.course.jwId,
        code: DEV_SEED.course.code,
        nameCn: DEV_SEED.course.nameCn,
        nameEn: DEV_SEED.course.nameEn,
      },
    });
    const teacher = await tx.teacher.create({
      data: {
        jwId: DEV_SEED.teacher.jwId,
        code: DEV_SEED.teacher.code,
        nameCn: DEV_SEED.teacher.nameCn,
        nameEn: DEV_SEED.teacher.nameEn,
      },
    });
    const section = await tx.section.create({
      data: {
        jwId: DEV_SEED.section.jwId,
        code: DEV_SEED.section.code,
        courseId: course.id,
        semesterId: semester.id,
        teachers: { connect: { id: teacher.id } },
      },
    });
    const users = [];
    for (const index of [0, 1]) {
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      users.push(
        await tx.user.create({
          data: {
            id: index === 0 ? actorId : crypto.randomUUID(),
            name: `Shell viewer ${suffix}`,
            username: `shell${suffix}`,
            email: `shell-${suffix}@example.test`,
            todos:
              index === 0
                ? {
                    create: [
                      { title: `Shell task ${suffix} A` },
                      { title: `Shell task ${suffix} B` },
                    ],
                  }
                : undefined,
          },
        }),
      );
    }
    await tx.userSectionSubscription.create({
      data: { userId: users[0].id, sectionId: section.id },
    });
    const incomplete = [];
    if (plan.incomplete) {
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      incomplete.push(
        await tx.user.create({
          data: {
            name: "",
            username: `new${suffix}`,
            email: `noname-${suffix}@example.test`,
          },
        }),
      );
      incomplete.push(
        await tx.user.create({
          data: {
            name: `New viewer ${suffix}`,
            email: `nousername-${suffix}@example.test`,
          },
        }),
      );
    }
    const organizer = await tx.youngOrganizer.create({
      data: {
        name: DEV_SEED.youngEvent.organizer,
        normalizedName: "private-shell-club",
      },
    });
    const event = await tx.youngEvent.create({
      data: {
        youngId: DEV_SEED.youngEvent.youngId,
        name: DEV_SEED.youngEvent.name,
        isActive: true,
        organizerId: organizer.id,
        startAt: new Date("2035-09-10T06:00:00Z"),
        endAt: new Date("2035-09-10T07:00:00Z"),
        rawJson: {},
      },
    });
    const client = plan.device
      ? await tx.oAuthClient.create({
          data: {
            clientId: crypto.randomUUID(),
            clientSecret: crypto.randomUUID(),
            name: "Private shell device client",
            type: "public",
            disabled: false,
            redirectUris: [`${origin}/oauth-e2e/callback`],
            scopes: [restReadScope("account.profile")],
            grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
            tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
            responseTypes: ["code"],
            requirePKCE: true,
            metadata: { source: "e2e_fixture" },
          },
        })
      : null;
    const debugId = crypto.randomUUID();
    const debugUser = plan.debug
      ? await tx.user.create({
          data: {
            id: debugId,
            username: DEV_SEED.debugUsername,
            name: DEV_SEED.debugName,
            email: "dev-user@debug.local",
            emailVerified: true,
            isAdmin: false,
            accounts: {
              create: {
                type: "credential",
                provider: "credential",
                issuer: createLocalAccountIssuer("credential"),
                providerAccountId: debugId,
                password,
              },
            },
          },
        })
      : null;
    if (plan.debug) {
      const campuses = [
        { id: 1, name: "Private East", latitude: 31.82, longitude: 117.28 },
        { id: 2, name: "Private West", latitude: 31.83, longitude: 117.26 },
      ];
      await tx.busCampus.createMany({
        data: campuses.map(({ name, ...campus }) => ({
          ...campus,
          nameCn: name,
        })),
      });
      const route = { id: 1, campuses };
      await tx.busRoute.create({
        data: {
          id: 1,
          nameCn: "Private East → Private West",
          stops: {
            create: campuses.map((campus, stopOrder) => ({
              campusId: campus.id,
              stopOrder,
            })),
          },
        },
      });
      const version = await tx.busScheduleVersion.create({
        data: {
          key: "private-shell-bus",
          title: "Private Shell Timetable",
          checksum: "private-shell-bus-checksum",
          effectiveFrom: new Date("2020-01-01"),
          isEnabled: true,
          rawJson: {
            campuses,
            routes: [route],
            weekday_routes: [{ id: 1, route, time: [["08:00", "08:20"]] }],
            saturday_routes: [{ id: 1, route, time: [["08:00", "08:20"]] }],
            sunday_routes: [{ id: 1, route, time: [["08:00", "08:20"]] }],
          },
        },
      });
      await tx.busTrip.createMany({
        data: (["weekday", "saturday", "sunday"] as const).map((dayType) => ({
          versionId: version.id,
          routeId: 1,
          dayType,
          position: 0,
          stopTimes: ["08:00", "08:20"],
        })),
      });
    }
    return { users, incomplete, teacher, organizer, event, client, debugUser };
  });
}

function relatedState(db: Database) {
  return db.$transaction(async (tx) => ({
    teachers: await tx.teacher.findMany({
      orderBy: { id: "asc" },
      include: {
        sections: { select: { id: true }, orderBy: { id: "asc" } },
      },
    }),
    organizers: await tx.youngOrganizer.findMany({ orderBy: { id: "asc" } }),
    accounts: await tx.account.findMany({ orderBy: { id: "asc" } }),
    clients: await tx.oAuthClient.findMany({ orderBy: { id: "asc" } }),
    descriptions: await tx.description.findMany({ orderBy: { id: "asc" } }),
    comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
    pins: await tx.workspaceLinkPin.findMany({ orderBy: { id: "asc" } }),
    clicks: await tx.catalogLinkClick.findMany({ orderBy: { id: "asc" } }),
    busPreferences: await tx.busUserPreference.findMany({
      orderBy: { userId: "asc" },
    }),
    organizerSubscriptions: await tx.userYoungOrganizerSubscription.findMany({
      orderBy: { userId: "asc" },
    }),
    notifications: await tx.youngNotification.findMany({
      orderBy: { id: "asc" },
    }),
    busCampuses: await tx.busCampus.findMany({ orderBy: { id: "asc" } }),
    busRoutes: await tx.busRoute.findMany({ orderBy: { id: "asc" } }),
    busStops: await tx.busRouteStop.findMany({ orderBy: { id: "asc" } }),
    busVersions: await tx.busScheduleVersion.findMany({
      orderBy: { id: "asc" },
    }),
    busTrips: await tx.busTrip.findMany({ orderBy: { id: "asc" } }),
  }));
}

type Shell = Awaited<ReturnType<typeof arrange>> & {
  origin: string;
  flow: CommunityFlow;
  sessionCookie: (
    userId: string,
  ) => Promise<Awaited<ReturnType<IsolatedWorker["createSession"]>>["cookie"]>;
  profileRead: (userId: string, work: () => Promise<void>) => Promise<void>;
};

export const test = ownedTest.extend<{
  shell: {
    run: (plan: Plan, work: (fixture: Shell) => Promise<void>) => Promise<void>;
  };
}>({
  shell: async (
    { isolatedWorker, page, browser, request: observer, run },
    use,
    testInfo,
  ) => {
    const db = isolatedWorker.database.owner;
    const origin = isolatedWorker.origin;
    const actorId = crypto.randomUUID();
    // Native use ends before the flow's interruption/finalization join. Setup
    // belongs to its actual callback, including uncancellable password hashing.
    await run(() =>
      withCommunityFlow(
        {
          page,
          browser,
          observer,
          isolatedWorker,
          account: { id: actorId },
          testInfo,
        },
        async (flow) => {
          await use({
            run: (plan, work) => {
              let fixture: Awaited<ReturnType<typeof arrange>>;
              let before: Awaited<ReturnType<typeof readCalendarState>>;
              let related: Awaited<ReturnType<typeof relatedState>>;
              const sessions: Session[] = [];
              const profileReads: (OAuthUsageWindow & { userId: string })[] =
                [];
              let startedAt: number;
              const browserWrites: {
                method: string;
                path: string;
                status: number;
              }[] = [];
              const wantedBrowserWrites = [
                ...(plan.sessions.some(({ deleted }) => deleted)
                  ? [{ method: "POST", path: "/account/sign-out", status: 303 }]
                  : []),
                ...(plan.debug
                  ? [{ method: "POST", path: "/account/sign-in", status: 200 }]
                  : []),
              ];
              return flow.run(
                async () => {
                  fixture = await arrange(db, origin, plan, actorId);
                  before = await readCalendarState(db);
                  related = await relatedState(db);
                  startedAt = Date.now();
                  const allUsers = [...fixture.users, ...fixture.incomplete];
                  await work({
                    ...fixture,
                    origin,
                    flow,
                    async sessionCookie(userId) {
                      const expected = plan.sessions[sessions.length];
                      expect(
                        expected,
                        "Every arranged session has a declared owner and lifetime",
                      ).toBeDefined();
                      expect(userId).toBe(allUsers[expected.user].id);
                      const session =
                        await isolatedWorker.createSession(userId);
                      const rows = await db.session.findMany({
                        where: { userId },
                      });
                      const added = rows.filter(
                        ({ id }) => !sessions.some((prior) => prior.id === id),
                      );
                      expect(added).toHaveLength(1);
                      sessions.push(added[0]);
                      return session.cookie;
                    },
                    async profileRead(userId, read) {
                      const start = Date.now();
                      await read();
                      profileReads.push({
                        userId,
                        start,
                        end: Date.now(),
                        operation: "read",
                      });
                    },
                  });
                },
                {
                  calendarTokenCreated: plan.feedToken,
                  auditActions: plan.sessions.some(({ deleted }) => deleted)
                    ? { account_sign_out: 1 }
                    : {},
                },
                {
                  async verifyBrowserWrite(response, incoming) {
                    const write = {
                      method: incoming.method(),
                      path: new URL(incoming.url()).pathname,
                      status: response.status(),
                    };
                    expect(write).toEqual(
                      wantedBrowserWrites[browserWrites.length],
                    );
                    browserWrites.push(write);
                    if (plan.debug) {
                      if (!fixture.debugUser)
                        throw new Error("Missing private debug account");
                      expect(await response.json()).toEqual({
                        type: "redirect",
                        status: 303,
                        location: `/catalog/sections/${DEV_SEED.section.jwId}`,
                      });
                      expect(
                        await db.session.count({
                          where: { userId: fixture.debugUser.id },
                        }),
                      ).toBe(1);
                    } else {
                      expect(response.headers().location).toBe("/");
                      expect(
                        await db.session.findUnique({
                          where: { id: sessions[0].id },
                        }),
                      ).toBeNull();
                    }
                  },
                  async verifyTransport({ producer, sdkRequests }) {
                    expect(sdkRequests).toEqual([]);
                    expect(browserWrites).toEqual(wantedBrowserWrites);
                    if (plan.device) {
                      expect(
                        producer.requests
                          .filter(
                            ({ value }) =>
                              value.path === "/api/account/profile",
                          )
                          .map(({ result }) => result),
                      ).toEqual([200, 200]);
                      expect(
                        producer.requests.filter(
                          ({ value, result }) =>
                            value.path === "/_internal/shell-bootstrap" &&
                            result === 401,
                        ),
                      ).toHaveLength(4);
                    }
                    const writes = producer.requests
                      .filter(
                        ({ value }) => !["GET", "HEAD"].includes(value.method),
                      )
                      .map(({ value, result }) => ({
                        method: value.method,
                        path: value.path,
                        status: result,
                      }));
                    const wanted = [
                      ...wantedBrowserWrites,
                      ...(plan.device
                        ? [0, 1].flatMap(() => [
                            {
                              method: "POST",
                              path: "/api/auth/oauth2/device-authorization",
                              status: 200,
                            },
                            {
                              method: "POST",
                              path: "/oauth/device",
                              status: 303,
                            },
                            {
                              method: "POST",
                              path: "/api/auth/oauth2/token",
                              status: 200,
                            },
                          ])
                        : []),
                    ];
                    expect(
                      writes.map((row) => JSON.stringify(row)).sort(),
                    ).toEqual(wanted.map((row) => JSON.stringify(row)).sort());
                  },
                  async verifyState() {
                    const actual = await readCalendarState(db);
                    const observedAt = Date.now();
                    if (plan.feedToken) {
                      const actor = actual.users.find(
                        ({ id }) => id === fixture.users[0].id,
                      );
                      expect(actor?.calendarFeedToken).toMatch(
                        /^[A-Za-z0-9_-]{32}$/,
                      );
                      expect(actor?.updatedAt.getTime()).toBeGreaterThanOrEqual(
                        startedAt,
                      );
                      expect(actor?.updatedAt.getTime()).toBeLessThanOrEqual(
                        observedAt,
                      );
                    }
                    expect(actual).toEqual({
                      ...before,
                      users: before.users.map((user) =>
                        plan.feedToken && user.id === fixture.users[0].id
                          ? {
                              ...user,
                              calendarFeedToken: expect.any(String),
                              updatedAt: expect.any(Date),
                            }
                          : user,
                      ),
                    });
                    expect(await relatedState(db)).toEqual(related);
                    expect(sessions).toHaveLength(plan.sessions.length);
                    const actualSessions = await db.session.findMany({
                      orderBy: { id: "asc" },
                    });
                    const expectedSessions: unknown[] = sessions.flatMap(
                      (session, index) => {
                        const expected = plan.sessions[index];
                        if (expected.deleted) return [];
                        const actual = actualSessions.find(
                          ({ id }) => id === session.id,
                        );
                        expect(actual).toBeDefined();
                        if (!actual)
                          throw new Error("Missing declared private session");
                        // Each case exercises authenticated SSR/data or a private projection.
                        const issuedAt =
                          actual.expires.getTime() - 30 * 86_400_000;
                        expect(issuedAt).toBeGreaterThanOrEqual(startedAt);
                        expect(issuedAt).toBeLessThanOrEqual(observedAt);
                        expect(
                          actual.updatedAt.getTime(),
                        ).toBeGreaterThanOrEqual(issuedAt);
                        expect(actual.updatedAt.getTime()).toBeLessThanOrEqual(
                          observedAt,
                        );
                        return [
                          {
                            ...session,
                            expires: expect.any(Date),
                            updatedAt: expect.any(Date),
                          },
                        ];
                      },
                    );
                    let debugSession: Session | undefined;
                    if (fixture.debugUser) {
                      const added = actualSessions.filter(
                        ({ id }) => !sessions.some((prior) => prior.id === id),
                      );
                      expect(added).toHaveLength(1);
                      debugSession = added[0];
                      expect(debugSession.userId).toBe(fixture.debugUser.id);
                      for (const time of [
                        debugSession.createdAt.getTime(),
                        debugSession.updatedAt.getTime(),
                        debugSession.expires.getTime() - 30 * 86_400_000,
                      ]) {
                        expect(time).toBeGreaterThanOrEqual(startedAt);
                        expect(time).toBeLessThanOrEqual(observedAt);
                      }
                      expect(debugSession.sessionToken).toMatch(
                        /^[A-Za-z0-9]+$/,
                      );
                      expectedSessions.push({
                        id: expect.any(String),
                        userId: fixture.debugUser.id,
                        sessionToken: expect.any(String),
                        ipAddress: expect.any(String),
                        userAgent: expect.stringContaining("Chrome"),
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date),
                        expires: expect.any(Date),
                      });
                    }
                    expect(actualSessions).toEqual(
                      expect.arrayContaining(expectedSessions),
                    );
                    expect(actualSessions).toHaveLength(
                      expectedSessions.length,
                    );
                    const auditRows = async () =>
                      (
                        await db.auditLog.findMany({
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
                        })
                      ).sort((a, b) => a.action.localeCompare(b.action));
                    const expectedAudits = [
                      ...(plan.feedToken
                        ? [
                            {
                              action: "account_calendar_token_create",
                              outcome: "success",
                              channel: "system",
                              userId: fixture.users[0].id,
                              subjectUserId: fixture.users[0].id,
                              targetId: fixture.users[0].id,
                              targetType: "calendar_feed",
                              sessionId: null,
                              oauthClientId: null,
                              oauthGrantId: null,
                              metadata: null,
                            },
                          ]
                        : []),
                      ...(debugSession && fixture.debugUser
                        ? [
                            {
                              action: "account_sign_in",
                              outcome: "success",
                              channel: "auth",
                              userId: fixture.debugUser.id,
                              subjectUserId: fixture.debugUser.id,
                              targetId: debugSession.id,
                              targetType: "session",
                              sessionId: debugSession.id,
                              oauthClientId: null,
                              oauthGrantId: null,
                              metadata: { authMethod: "password" },
                            },
                          ]
                        : []),
                      ...sessions.flatMap((session, index) =>
                        plan.sessions[index].deleted
                          ? [
                              {
                                action: "account_sign_out",
                                outcome: "success",
                                channel: "auth",
                                userId: session.userId,
                                subjectUserId: session.userId,
                                targetId: session.id,
                                targetType: "session",
                                sessionId: session.id,
                                oauthClientId: null,
                                oauthGrantId: null,
                                metadata: null,
                              },
                            ]
                          : [],
                      ),
                    ];
                    await expect
                      .poll(auditRows)
                      .toEqual(
                        expectedAudits.sort((a, b) =>
                          a.action.localeCompare(b.action),
                        ),
                      );
                    expect(await db.deviceCode.count()).toBe(0);
                    expect(await db.oAuthAccessToken.count()).toBe(0);
                    expect(await db.oAuthRefreshToken.count()).toBe(0);
                    const clientId = fixture.client?.clientId;
                    if (plan.device && !clientId)
                      throw new Error("Missing private device client");
                    const consents = await db.oAuthConsent.findMany({
                      orderBy: { userId: "asc" },
                      select: {
                        clientId: true,
                        userId: true,
                        grantId: true,
                        scopes: true,
                        resources: true,
                        requestedUserInfoClaims: true,
                        referenceId: true,
                      },
                    });
                    expect(consents).toEqual(
                      plan.device
                        ? fixture.users
                            .map((user) => ({
                              clientId: clientId,
                              userId: user.id,
                              grantId: expect.any(String),
                              scopes: ["account.profile:read"],
                              resources: [`${origin}/api/auth`],
                              requestedUserInfoClaims: [],
                              referenceId: null,
                            }))
                            .sort((a, b) => a.userId.localeCompare(b.userId))
                        : [],
                    );
                    const usage = await db.oAuthGrantUsageDaily.findMany({
                      orderBy: { day: "asc" },
                    });
                    expect(profileReads).toHaveLength(plan.device ? 2 : 0);
                    if (!plan.device) expect(usage).toEqual([]);
                    else {
                      expect(
                        usage.every(({ userId }) =>
                          fixture.users.some((user) => user.id === userId),
                        ),
                      ).toBe(true);
                      for (const user of fixture.users) {
                        const grant = consents.find(
                          ({ userId }) => userId === user.id,
                        );
                        if (!grant)
                          throw new Error("Missing shell device grant");
                        expect(grant.grantId).toMatch(/^[0-9a-f-]{36}$/i);
                        expectOAuthUsage(
                          usage.filter(({ userId }) => userId === user.id),
                          {
                            dimensions: {
                              userId: user.id,
                              clientId: clientId,
                              grantId: grant.grantId,
                              feature: "account.profile",
                              channel: "rest",
                            },
                            counts: [1, 0, 0],
                            windows: profileReads.filter(
                              ({ userId }) => userId === user.id,
                            ),
                          },
                        );
                      }
                    }
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
