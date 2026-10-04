import { type APIRequestContext, expect, type Locator } from "@playwright/test";
import type { CalendarProtocolChecks } from "./calendar-protocol-lifecycle";
import type { IsolatedWorker } from "./isolated-worker";
import { createUploadBucket } from "./upload-bucket";

export function countCopyCheck(locale: string, count: number) {
  return async (locator: Locator, expected: string, label: string) => {
    await expect
      .soft(locator, `${locale} ${count}: ${label}`)
      .toHaveText(expected);
  };
}

/** Observe the prepared domain and unrelated state after native effects drain. */
export async function prepareCountObservation(
  worker: IsolatedWorker,
  request: APIRequestContext,
  userId?: string,
) {
  const db = worker.database.owner;
  const stable = () =>
    db.$transaction(async (tx) => ({
      users: await tx.user.findMany({ orderBy: { id: "asc" } }),
      semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
      courses: await tx.course.findMany({ orderBy: { id: "asc" } }),
      sections: await tx.section.findMany({ orderBy: { id: "asc" } }),
      descriptions: await tx.description.findMany({ orderBy: { id: "asc" } }),
      comments: await tx.comment.findMany({ orderBy: { id: "asc" } }),
      clients: await tx.oAuthClient.findMany({ orderBy: { id: "asc" } }),
      organizers: await tx.youngOrganizer.findMany({ orderBy: { id: "asc" } }),
      events: await tx.youngEvent.findMany({ orderBy: { youngId: "asc" } }),
      notifications: await tx.youngNotification.findMany({
        orderBy: { id: "asc" },
      }),
      sources: await tx.publicationSource.findMany({ orderBy: { id: "asc" } }),
    }));
  const baseline = await stable();
  const sessions = await db.session.findMany();
  const sessionStarted = Date.now();
  const fixtureAudits = await db.auditLog.findMany({ orderBy: { id: "asc" } });
  expect(sessions).toHaveLength(userId ? 1 : 0);
  if (userId) expect(sessions[0].userId).toBe(userId);

  return {
    checks({
      feedTokenCreated,
      subscriptions,
      writes,
    }: {
      feedTokenCreated: boolean;
      subscriptions: { userId: string; sectionId: number; kind: "regular" }[];
      writes: [string, string, number][];
    }): CalendarProtocolChecks {
      const sessionFinished = Date.now();
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          expect(
            effects.requests
              .filter(({ value }) => !["GET", "HEAD"].includes(value.method))
              .map(({ value, result }) => [value.method, value.path, result]),
          ).toEqual(writes);
        },
        async verifyState() {
          expect(await stable()).toEqual({
            ...baseline,
            users: baseline.users.map((user) =>
              feedTokenCreated && user.id === userId
                ? {
                    ...user,
                    calendarFeedToken: expect.any(String),
                    updatedAt: expect.any(Date),
                  }
                : user,
            ),
          });
          expect(
            await db.userSectionSubscription.findMany({
              orderBy: { sectionId: "asc" },
              select: { userId: true, sectionId: true, kind: true },
            }),
          ).toEqual(
            [...subscriptions].sort((a, b) => a.sectionId - b.sectionId),
          );
          const finalSessions = await db.session.findMany();
          expect(finalSessions).toEqual(
            sessions.map((session) => ({
              ...session,
              expires: expect.any(Date),
              updatedAt: expect.any(Date),
            })),
          );
          for (const [index, session] of finalSessions.entries()) {
            const expiryClock = session.expires.getTime() - 30 * 86400_000;
            for (const time of [expiryClock, session.updatedAt.getTime()]) {
              expect(time).toBeGreaterThanOrEqual(sessionStarted);
              expect(time).toBeLessThanOrEqual(sessionFinished);
            }
            expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(
              expiryClock,
            );
            expect(session.expires.getTime()).toBeGreaterThan(
              sessions[index].expires.getTime(),
            );
          }
          expect(
            await db.user.findMany({
              orderBy: { id: "asc" },
              select: { id: true, calendarFeedToken: true },
            }),
          ).toEqual(
            baseline.users.map(({ id }) => ({
              id,
              calendarFeedToken:
                feedTokenCreated && id === userId ? expect.any(String) : null,
            })),
          );
          expect(
            await db.auditLog.findMany({
              where: { action: "account_profile_update" },
              orderBy: { id: "asc" },
            }),
          ).toEqual(fixtureAudits);
          expect(
            await db.auditLog.findMany({
              where: { action: { not: "account_profile_update" } },
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
          expect(await db.publication.count()).toBe(0);
          expect(await db.publicationRevision.count()).toBe(0);
          expect(await db.oAuthConsent.count()).toBe(0);
          expect(await db.oAuthRefreshToken.count()).toBe(0);
          expect(await db.oAuthAccessToken.count()).toBe(0);
          expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
          expect(await db.deviceCode.count()).toBe(0);
          expect(await db.upload.count()).toBe(0);
          expect(await db.uploadPending.count()).toBe(0);
          expect(
            await createUploadBucket(request, worker.origin).list({
              prefix: "uploads/",
            }),
          ).toEqual({ objects: [], truncated: false });
        },
      };
    },
  };
}
