import { createLocalAccountIssuer } from "@better-auth/core/db";
import { expect, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import type { Session } from "../../../../src/generated/prisma-node/client";
import { readCalendarState } from "../../utils/calendar-read-observation";
import {
  type CommunityFlow,
  withCommunityFlow,
} from "../../utils/community-flow";
import { DEV_SEED } from "../../utils/dev-seed";
import type { IsolatedWorker } from "../../utils/isolated-worker";
import { observeAction } from "../../utils/observed-action";
import { test as ownedTest } from "../../utils/owned-worker";
import { gotoAndWaitForReady, waitForUiSettled } from "../../utils/page-ready";

type Database = IsolatedWorker["database"]["owner"];
type Plan = {
  loginRedirect: string;
  bus?: { showDepartedTrips: boolean };
};

async function arrange(db: Database, userId: string, plan: Plan) {
  const password = await hashPassword("dev-debug-password");
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        name: DEV_SEED.debugName,
        username: DEV_SEED.debugUsername,
        email: "dev-user@debug.local",
        emailVerified: true,
        isAdmin: false,
        accounts: {
          create: {
            type: "credential",
            provider: "credential",
            issuer: createLocalAccountIssuer("credential"),
            providerAccountId: userId,
            password,
          },
        },
      },
    });
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
        credits: DEV_SEED.section.credits,
        teachers: { connect: { id: teacher.id } },
      },
    });
    const group = await tx.scheduleGroup.create({
      data: {
        jwId: DEV_SEED.section.jwId,
        sectionId: section.id,
        no: 1,
        limitCount: 20,
        stdCount: 1,
        actualPeriods: 2,
        isDefault: true,
      },
    });
    await tx.schedule.create({
      data: {
        sectionId: section.id,
        scheduleGroupId: group.id,
        date: new Date("2026-09-30T00:00:00Z"),
        weekday: 3,
        startTime: 900,
        endTime: 1000,
        startUnit: 1,
        endUnit: 2,
        weekIndex: 1,
        periods: 2,
        teacherParticipations: {
          create: { teacherId: teacher.id, periods: 2 },
        },
      },
    });
    await tx.userSectionSubscription.create({
      data: { userId, sectionId: section.id },
    });
    await tx.description.create({
      data: {
        courseId: course.id,
        content: "# 课程建议\n\nPrivate public introduction.",
        lastEditedById: userId,
      },
    });
    await tx.workspaceLinkPin.createMany({
      data: ["jw", "confession-wall", "mail", "official"].map((slug) => ({
        userId,
        slug,
      })),
    });
    if (plan.bus) {
      // Only the populated planner graph needed by these two cases is arranged.
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
          key: "private-overlay-bus",
          title: "Private Overlay Timetable",
          checksum: "private-overlay-bus-checksum",
          effectiveFrom: new Date("2020-01-01"),
          isEnabled: true,
          rawJson: {
            campuses,
            routes: [route],
            weekday_routes: [
              {
                id: 1,
                route,
                time: [
                  ["08:00", "08:20"],
                  ["22:00", "22:20"],
                ],
              },
            ],
            saturday_routes: [
              {
                id: 1,
                route,
                time: [
                  ["08:00", "08:20"],
                  ["22:00", "22:20"],
                ],
              },
            ],
            sunday_routes: [
              {
                id: 1,
                route,
                time: [
                  ["08:00", "08:20"],
                  ["22:00", "22:20"],
                ],
              },
            ],
          },
        },
      });
      await tx.busTrip.createMany({
        data: (["weekday", "saturday", "sunday"] as const).flatMap((dayType) =>
          [
            ["08:00", "08:20"],
            ["22:00", "22:20"],
          ].map((stopTimes, position) => ({
            versionId: version.id,
            routeId: 1,
            dayType,
            position,
            stopTimes,
          })),
        ),
      });
      await tx.busUserPreference.create({
        data: {
          userId,
          preferredOriginCampusId: null,
          preferredDestinationCampusId: null,
          showDepartedTrips: plan.bus.showDepartedTrips,
        },
      });
    }
    return user;
  });
}

async function state(db: Database) {
  return {
    calendar: await readCalendarState(db),
    related: await db.$transaction(async (tx) => ({
      accounts: await tx.account.findMany({ orderBy: { id: "asc" } }),
      teachers: await tx.teacher.findMany({
        orderBy: { id: "asc" },
        include: {
          sections: { select: { id: true }, orderBy: { id: "asc" } },
          scheduleParticipations: { orderBy: { scheduleId: "asc" } },
        },
      }),
      descriptions: await tx.description.findMany({
        orderBy: { id: "asc" },
        include: { edits: true },
      }),
      comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
      pins: await tx.workspaceLinkPin.findMany({ orderBy: { slug: "asc" } }),
      clicks: await tx.catalogLinkClick.findMany({ orderBy: { id: "asc" } }),
      preferences: await tx.busUserPreference.findMany({
        orderBy: { userId: "asc" },
      }),
      campuses: await tx.busCampus.findMany({ orderBy: { id: "asc" } }),
      routes: await tx.busRoute.findMany({ orderBy: { id: "asc" } }),
      stops: await tx.busRouteStop.findMany({ orderBy: { id: "asc" } }),
      versions: await tx.busScheduleVersion.findMany({
        orderBy: { id: "asc" },
      }),
      trips: await tx.busTrip.findMany({ orderBy: { id: "asc" } }),
      oauthClients: await tx.oAuthClient.findMany({ orderBy: { id: "asc" } }),
      consents: await tx.oAuthConsent.findMany({ orderBy: { id: "asc" } }),
      accessTokens: await tx.oAuthAccessToken.findMany({
        orderBy: { id: "asc" },
      }),
      refreshTokens: await tx.oAuthRefreshToken.findMany({
        orderBy: { id: "asc" },
      }),
      deviceCodes: await tx.deviceCode.findMany({ orderBy: { id: "asc" } }),
      usage: await tx.oAuthGrantUsageDaily.findMany({ orderBy: { id: "asc" } }),
    })),
  };
}

/** Uncached, real dev-button sign-in to the original requested destination. */
export async function signInPrivateDebugUser(page: Page, callbackPath: string) {
  const destination =
    callbackPath === "/workspace" ? "/workspace/overview" : callbackPath;
  await gotoAndWaitForReady(
    page,
    `/account/sign-in?callbackUrl=${encodeURIComponent(callbackPath)}`,
  );
  await page
    .getByRole("button", { name: /Debug User \(Dev\)|调试用户（开发）/i })
    .click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  await waitForUiSettled(page);
  const response = await page.request.get(
    "/api/auth/get-session?disableCookieCache=true",
  );
  expect(response.status()).toBe(200);
  expect((await response.json()).user).toMatchObject({
    name: DEV_SEED.debugName,
    username: DEV_SEED.debugUsername,
    isAdmin: false,
  });
  await expect(page.locator("#main-content")).toBeVisible();
}

export const test = ownedTest.extend<{
  overlay: {
    run: (
      plan: Plan,
      work: (flow: CommunityFlow) => Promise<void>,
    ) => Promise<void>;
  };
}>({
  overlay: async (
    { isolatedWorker, page, browser, request: observer, run },
    use,
    testInfo,
  ) => {
    const db = isolatedWorker.database.owner;
    const userId = crypto.randomUUID();
    await run(() =>
      withCommunityFlow(
        {
          page,
          browser,
          observer,
          isolatedWorker,
          account: { id: userId },
          testInfo,
        },
        async (flow) => {
          await use({
            run: (plan, work) => {
              let baseline: Awaited<ReturnType<typeof state>>;
              let loginSession: Session | undefined;
              let startedAt: number;
              const writes: { method: string; path: string; status: number }[] =
                [];
              const expectedWrites = [
                { method: "POST", path: "/account/sign-in", status: 200 },
              ];
              return flow.run(
                async () => {
                  await arrange(db, userId, plan);
                  baseline = await state(db);
                  expect(await db.session.findMany()).toEqual([]);
                  startedAt = Date.now();
                  const sectionDestination = `/catalog/sections/${DEV_SEED.section.jwId}`;
                  const viewerPath = `/_internal/catalog/sections/${DEV_SEED.section.jwId}/viewer`;
                  const sectionLogin =
                    plan.loginRedirect === sectionDestination;
                  if (!sectionLogin) {
                    await work(flow);
                    return;
                  }
                  // Signing in on the section destination reads its viewer.
                  // Observe that actual read alongside the work and require it
                  // to complete successfully.
                  const viewerResponse = await observeAction(
                    () =>
                      page.waitForResponse(
                        (response) =>
                          response.request().method() === "GET" &&
                          new URL(response.url()).pathname === viewerPath,
                      ),
                    () => work(flow),
                  );
                  expect(viewerResponse.status()).toBe(200);
                  await viewerResponse.body();
                },
                { auditActions: { account_sign_in: 1 } },
                {
                  async verifyBrowserWrite(response, incoming) {
                    const write = {
                      method: incoming.method(),
                      path: new URL(incoming.url()).pathname,
                      status: response.status(),
                    };
                    expect(write).toEqual(expectedWrites[writes.length]);
                    writes.push(write);
                    // The enhanced Svelte action retains its original callback URL.
                    expect(await response.json()).toEqual({
                      type: "redirect",
                      status: 303,
                      location: plan.loginRedirect,
                    });
                    const sessions = await db.session.findMany();
                    expect(sessions).toHaveLength(1);
                    loginSession = sessions[0];
                    const observedAt = Date.now();
                    expect(loginSession).toEqual({
                      id: expect.any(String),
                      sessionToken: expect.any(String),
                      userId,
                      ipAddress: expect.any(String),
                      userAgent: expect.stringContaining("Chrome"),
                      createdAt: expect.any(Date),
                      updatedAt: expect.any(Date),
                      expires: expect.any(Date),
                    });
                    expect(loginSession.sessionToken).toMatch(/^[A-Za-z0-9]+$/);
                    for (const time of [
                      loginSession.createdAt.getTime(),
                      loginSession.updatedAt.getTime(),
                      loginSession.expires.getTime() - 30 * 86_400_000,
                    ]) {
                      expect(time).toBeGreaterThanOrEqual(startedAt);
                      expect(time).toBeLessThanOrEqual(observedAt);
                    }
                  },
                  async verifyTransport({ producer, sdkRequests }) {
                    expect(sdkRequests).toEqual([]);
                    expect(writes).toEqual(expectedWrites);
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
                    ).toEqual(expectedWrites);
                  },
                  async verifyState() {
                    expect(await state(db)).toEqual(baseline);
                    if (!loginSession)
                      throw new Error(
                        "Private debug UI sign-in did not create its session",
                      );
                    // Clearing browser cookies changes the current viewer, not the stored session.
                    expect(await db.session.findMany()).toEqual([loginSession]);
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
                    await expect.poll(audits).toEqual([
                      {
                        action: "account_sign_in",
                        outcome: "success",
                        channel: "auth",
                        userId,
                        subjectUserId: userId,
                        targetId: loginSession.id,
                        targetType: "session",
                        sessionId: loginSession.id,
                        oauthClientId: null,
                        oauthGrantId: null,
                        metadata: { authMethod: "password" },
                      },
                    ]);
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
