import { expect, type Page } from "@playwright/test";
import type { Prisma } from "../../../../../src/generated/prisma-node/client";
import type { CalendarMessage } from "../../../utils/calendar-effects";
import type {
  CalendarBrowserWriteVerifier,
  CalendarProtocol,
  CalendarProtocolChecks,
} from "../../../utils/calendar-protocol-lifecycle";
import { readCalendarState } from "../../../utils/calendar-read-observation";
import { DEV_SEED } from "../../../utils/dev-seed";
import type { IsolatedWorker } from "../../../utils/isolated-worker";

export { test } from "../../../utils/private-calendar-fixture";
export type SemesterProtocolRun = (
  work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
  verifyBrowserWrite?: CalendarBrowserWriteVerifier,
) => Promise<void>;

/** Explicit term prerequisites in the caller's atomic, private setup. */
export async function createSemesterTerms(db: Prisma.TransactionClient) {
  const current = await db.semester.create({
    data: {
      jwId: DEV_SEED.semesterJwId,
      code: "421",
      nameCn: DEV_SEED.semesterNameCn,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-12-31"),
    },
  });
  const previous = await db.semester.create({
    data: {
      jwId: DEV_SEED.previousSemesterJwId,
      code: "420",
      nameCn: DEV_SEED.previousSemesterNameCn,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-03-31"),
    },
  });
  return { current, previous };
}

export async function createPastSemesterFixture(
  db: Prisma.TransactionClient,
  {
    marker,
    name,
    activity,
  }: { marker: string; name: string; activity: boolean },
) {
  const { previous } = await createSemesterTerms(db);
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name,
      username: `semester${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
      email: `${marker}@example.test`,
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
  const section = await db.section.create({
    data: {
      jwId: DEV_SEED.previousSection.jwId,
      code: DEV_SEED.previousSection.code,
      courseId: course.id,
      semesterId: previous.id,
    },
    include: { semester: true },
  });
  await db.userSectionSubscription.create({
    data: { userId: user.id, sectionId: section.id },
  });
  await db.homework.create({
    data: {
      sectionId: section.id,
      createdById: user.id,
      title: DEV_SEED.homeworks.historicalTitle,
      publishedAt: new Date("2026-03-20T00:00:00+08:00"),
    },
  });
  if (activity) {
    await db.todo.create({ data: { userId: user.id, title: marker } });
    const organizer = await db.youngOrganizer.create({
      data: {
        name: DEV_SEED.youngEvent.organizer,
        normalizedName: "semester-club",
      },
    });
    await db.youngEvent.create({
      data: {
        youngId: DEV_SEED.youngEvent.youngId,
        name: DEV_SEED.youngEvent.name,
        organizerId: organizer.id,
        startAt: new Date("2035-09-10T06:00:00Z"),
        endAt: new Date("2035-09-10T07:00:00Z"),
        isActive: true,
        rawJson: {},
      },
    });
    await db.userYoungEventSubscription.create({
      data: {
        userId: user.id,
        youngId: DEV_SEED.youngEvent.youngId,
        observedState: "open",
      },
    });
  }
  return { user, section };
}

type ExpectedRequest = readonly [
  method: string,
  path: string,
  statuses: readonly number[],
];

/** Join real browser/protocol work through calendarProtocolRun; compare the
 * complete prepared graph after its native effects drain. */
export async function prepareSemesterObservation(
  page: Page,
  worker: IsolatedWorker,
  io: CalendarProtocol,
  userId: string,
  messages: CalendarMessage[],
) {
  const db = worker.database.owner;
  await io.observeCalendar({ id: userId }, messages);
  await page
    .context()
    .addCookies([(await worker.createSession(userId)).cookie]);
  const before = await readCalendarState(db);
  const readRelated = () =>
    db.$transaction(async (tx) => ({
      teachers: await tx.teacher.findMany({
        orderBy: { id: "asc" },
        include: { sections: { select: { id: true }, orderBy: { id: "asc" } } },
      }),
      organizers: await tx.youngOrganizer.findMany({ orderBy: { id: "asc" } }),
      sessions: await tx.session.findMany({ orderBy: { id: "asc" } }),
    }));
  const related = await readRelated();
  expect(related.sessions).toEqual([expect.objectContaining({ userId })]);
  const startedAt = Date.now();
  return {
    checks({
      feedTokenCreated,
      requests,
      subscriptionKind,
    }: {
      feedTokenCreated: boolean;
      requests: ExpectedRequest[];
      subscriptionKind?: { sectionId: number; kind: "auditor" };
    }): CalendarProtocolChecks {
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          const expected = requests.flatMap(([method, path, statuses]) =>
            statuses.map((status) => ({ method, path, status })),
          );
          expect(
            effects.requests
              .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
              .map(({ value, result }) =>
                JSON.stringify({
                  method: value.method,
                  path: value.path,
                  status: result,
                }),
              )
              .sort(),
          ).toEqual(expected.map((request) => JSON.stringify(request)).sort());
        },
        async verifyState() {
          const actual = await readCalendarState(db);
          const observedAt = Date.now();
          if (feedTokenCreated) {
            const user = actual.users.find(({ id }) => id === userId);
            const original = before.users.find(({ id }) => id === userId);
            if (!user || !original) throw new Error("Missing semester account");
            expect(original.calendarFeedToken).toBeNull();
            expect(user.calendarFeedToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
            expect(user.updatedAt.getTime()).toBeGreaterThanOrEqual(
              original.updatedAt.getTime(),
            );
            expect(user.updatedAt.getTime()).toBeLessThanOrEqual(observedAt);
          }
          expect(actual).toEqual({
            ...before,
            users: before.users.map((user) =>
              feedTokenCreated && user.id === userId
                ? {
                    ...user,
                    calendarFeedToken: expect.any(String),
                    updatedAt: expect.any(Date),
                  }
                : user,
            ),
            subscriptions: before.subscriptions.map((subscription) =>
              subscriptionKind &&
              subscription.userId === userId &&
              subscription.sectionId === subscriptionKind.sectionId
                ? { ...subscription, kind: subscriptionKind.kind }
                : subscription,
            ),
          });
          const currentRelated = await readRelated();
          expect(currentRelated.sessions).toHaveLength(1);
          const session = currentRelated.sessions[0];
          // Native authentication refreshes the fixture's one-hour session to
          // the normal 30-day lifetime; its identity and creation time stay fixed.
          expect(currentRelated).toEqual({
            ...related,
            sessions: [
              {
                ...related.sessions[0],
                expires: expect.any(Date),
                updatedAt: expect.any(Date),
              },
            ],
          });
          const refreshedAt =
            session.expires.getTime() - 30 * 24 * 60 * 60 * 1000;
          for (const time of [refreshedAt, session.updatedAt.getTime()]) {
            expect(time).toBeGreaterThanOrEqual(startedAt);
            expect(time).toBeLessThanOrEqual(Date.now());
          }
          expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(
            refreshedAt,
          );
          expect(session.expires.getTime()).toBeGreaterThan(
            related.sessions[0].expires.getTime(),
          );
          expect(
            await db.auditLog.findMany({
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
            }),
          ).toEqual(
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
          expect(await db.oAuthClient.count()).toBe(0);
          expect(await db.oAuthConsent.count()).toBe(0);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
        },
      };
    },
  };
}

export const verifySemesterMatch: CalendarBrowserWriteVerifier = async (
  response,
  request,
) => {
  expect(request.method()).toBe("POST");
  expect(new URL(request.url()).pathname).toBe(
    "/api/workspace/subscriptions/query",
  );
  expect(response.status()).toBe(200);
  await response.body();
};
