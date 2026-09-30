import { expect, type Request } from "@playwright/test";
import type { TestPrismaClient } from "../../shared/prisma";
import { withCommunityFlow } from "./community-flow";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";

async function createAdminPriorityFixture(owner: TestPrismaClient) {
  return owner.$transaction(async (db) => {
    const marker = crypto.randomUUID();
    const base = 1_300_000_000 + Math.floor(Math.random() * 100_000_000);
    const admin = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "Priority administrator",
        username: `pa${marker.replaceAll("-", "").slice(0, 20)}`,
        email: `priority-admin-${marker}@example.test`,
        isAdmin: true,
      },
    });
    const author = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        name: "Priority review author",
        username: `pr${marker.replaceAll("-", "").slice(0, 20)}`,
        email: `priority-author-${marker}@example.test`,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: base,
        code: "PRIORITY",
        nameCn: "优先级验收课程",
        nameEn: "Priority review course",
      },
    });
    const section = await db.section.create({
      data: { jwId: base + 1, courseId: course.id, code: "PRIORITY.01" },
    });
    const suspension = await db.userSuspension.create({
      data: {
        userId: author.id,
        createdById: admin.id,
        reason: "Priority review suspension",
        expiresAt: new Date("2099-01-01T00:00:00Z"),
      },
    });
    const comment = await db.comment.create({
      data: {
        userId: author.id,
        sectionId: section.id,
        body: "Priority review comment content",
        createdAt: new Date("2026-01-03T00:00:00Z"),
        status: "softbanned",
        moderationNote: "Priority review note",
      },
    });
    const description = await db.description.create({
      data: {
        courseId: course.id,
        content: "Priority review description content",
        lastEditedById: author.id,
        lastEditedAt: new Date("2026-01-04T00:00:00Z"),
        updatedAt: new Date("2026-01-06T00:00:00Z"),
      },
    });
    const fallbackDescription = await db.description.create({
      data: {
        sectionId: section.id,
        content: "Priority review fallback description",
        lastEditedById: author.id,
        lastEditedAt: null,
        updatedAt: new Date("2026-01-07T00:00:00Z"),
      },
    });
    const homework = await db.homework.create({
      data: {
        sectionId: section.id,
        createdById: author.id,
        title: "Priority review homework title",
        createdAt: new Date("2026-01-05T00:00:00Z"),
        submissionDueAt: new Date("2026-12-01T00:00:00Z"),
      },
    });
    const client = await db.oAuthClient.create({
      data: {
        clientId: "priority-review-client",
        name: "Priority review application",
        userId: admin.id,
        public: true,
        tokenEndpointAuthMethod: "none",
        skipConsent: false,
        scopes: ["catalog:read"],
        redirectUris: ["https://example.test/callback"],
        grantTypes: ["authorization_code"],
        createdAt: new Date("2026-01-08T00:00:00Z"),
      },
    });
    const bus = await db.busScheduleVersion.create({
      data: {
        id: base + 2,
        key: "priority-review-timetable",
        checksum: marker,
        title: "Priority review timetable",
        sourceMessage: "Priority review schedule source",
        isEnabled: false,
        importedAt: new Date("2026-01-09T00:00:00Z"),
        effectiveFrom: new Date("2026-02-01T00:00:00Z"),
        effectiveUntil: new Date("2026-12-31T00:00:00Z"),
        rawJson: {},
      },
    });
    return {
      admin,
      author,
      suspension,
      course,
      section,
      comment,
      description,
      fallbackDescription,
      homework,
      client,
      bus,
    };
  });
}

export type AdminPriorityFixture = Awaited<
  ReturnType<typeof createAdminPriorityFixture>
>;

async function assertUnchangedState(
  db: TestPrismaClient,
  data: AdminPriorityFixture,
) {
  expect(await db.user.findMany({ orderBy: { username: "asc" } })).toEqual([
    data.admin,
    data.author,
  ]);
  expect(await db.userSuspension.findMany()).toEqual([data.suspension]);
  expect(await db.course.findMany()).toEqual([data.course]);
  expect(await db.section.findMany()).toEqual([data.section]);
  expect(await db.comment.findMany()).toEqual([data.comment]);
  expect(
    await db.description.findMany({ orderBy: { content: "asc" } }),
  ).toEqual([data.description, data.fallbackDescription]);
  expect(await db.descriptionEdit.findMany()).toEqual([]);
  expect(await db.homework.findMany()).toEqual([data.homework]);
  expect(await db.homeworkCompletion.findMany()).toEqual([]);
  expect(await db.oAuthClient.findMany()).toEqual([data.client]);
  expect(await db.oAuthConsent.findMany()).toEqual([]);
  expect(await db.busScheduleVersion.findMany()).toEqual([data.bus]);
  expect(await db.busTrip.findMany()).toEqual([]);
}

/** The four presentation consumers each own their complete admin catalog.
 * Fixed client/version keys are private to that case's database. */
export const test = workerTest.extend<{
  adminPriority: AdminPriorityFixture;
  adminPrioritySession: Awaited<ReturnType<IsolatedWorker["createSession"]>>;
  adminPriorityRun: (
    work: (data: AdminPriorityFixture) => Promise<void>,
  ) => Promise<void>;
}>({
  adminPriority: async ({ isolatedWorker, run }, use) => {
    await use(
      await run(() =>
        createAdminPriorityFixture(isolatedWorker.database.owner),
      ),
    );
  },
  adminPrioritySession: async ({ isolatedWorker, adminPriority, run }, use) => {
    await use(
      await run(() => isolatedWorker.createSession(adminPriority.admin.id)),
    );
  },
  adminPriorityRun: async (
    {
      page,
      browser,
      request: observer,
      isolatedWorker,
      adminPriority: data,
      adminPrioritySession,
      run,
    },
    use,
    testInfo,
  ) => {
    await run(async () => {
      const requests: {
        method: string;
        path: string;
        document: boolean;
      }[] = [];
      const onRequest = (incoming: Request) => {
        const url = new URL(incoming.url());
        if (url.origin !== isolatedWorker.origin) return;
        requests.push({
          method: incoming.method(),
          path: `${url.pathname}${url.search}`,
          document:
            incoming.isNavigationRequest() &&
            incoming.frame() === page.mainFrame(),
        });
      };
      page.on("request", onRequest);
      const results = await Promise.allSettled([
        withCommunityFlow(
          {
            page,
            browser,
            observer,
            isolatedWorker,
            account: data.admin,
            testInfo,
          },
          async (flow) => {
            await use((work) =>
              flow.run(
                async () => {
                  await page
                    .context()
                    .addCookies([adminPrioritySession.cookie]);
                  await work(data);
                },
                {
                  calendarTokenCreated: false,
                  auditActions: {},
                  catalogPurges: 0,
                },
              ),
            );
          },
        ),
      ]);
      page.off("request", onRequest);
      // The shared flow has closed the page, joined the actual UI callback and
      // drained native requests/deferred work. Check every read-only invariant
      // even when that flow or the presentation assertions failed.
      const db = isolatedWorker.database.owner;
      results.push(
        ...(await Promise.allSettled([
          (async () => {
            expect(requests.filter(({ method }) => method !== "GET")).toEqual(
              [],
            );
            expect(
              requests
                .filter(({ document }) => document)
                .map(({ path }) => path),
            ).toEqual([
              `/admin/users?search=${data.author.username}`,
              "/admin/oauth",
              "/admin/bus",
              "/admin/moderation?tab=comments&status=softbanned&search=Priority%20review%20comment",
              "/admin/moderation?tab=descriptions&search=Priority%20review",
              "/admin/moderation?tab=homeworks&search=Priority%20review",
            ]);
          })(),
          assertUnchangedState(db, data),
          expect(db.auditLog.findMany()).resolves.toEqual([]),
          expect(db.oAuthGrantUsageDaily.findMany()).resolves.toEqual([]),
        ])),
      );
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Admin priority workflow failed");
    });
  },
});
