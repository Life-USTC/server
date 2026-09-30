import { expect, type Page } from "@playwright/test";
import type { User } from "@/generated/prisma-node/client";
import { test as communityTest } from "../../../utils/community-fixture";
import type {
  CommunityChecks,
  CommunityFlow,
} from "../../../utils/community-flow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";

type Kind = "delete" | "suspend" | "moderate";
type Section = { id: number; jwId: number };

async function prepareDestructiveSecurity(
  kind: Kind,
  page: Page,
  worker: IsolatedWorker,
  flow: CommunityFlow,
  account: User,
  section?: Section,
) {
  if (kind !== "suspend" && !section)
    throw new Error("Comment scenario requires its private section");
  const db = worker.database.owner;
  const marker = `${kind}-announcement-${crypto.randomUUID()}`;
  const actor =
    kind === "delete"
      ? account
      : await db.user.update({
          where: { id: account.id },
          data: { isAdmin: true },
        });
  const subject =
    kind === "suspend"
      ? await db.user.create({
          data: {
            id: crypto.randomUUID(),
            name: marker,
            username: `st${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${marker}-target@example.test`,
          },
        })
      : actor;
  const stable = () =>
    db.$transaction(async (tx) => ({
      users: (await tx.user.findMany({ orderBy: { id: "asc" } })).map(
        (user) => {
          // Permission changes deliberately update this actor's updatedAt. Every
          // other account property, including final privilege and feed token, stays fixed.
          if (kind !== "delete" && user.id === actor.id) {
            const { updatedAt, ...unchanged } = user;
            expect(updatedAt).toEqual(expect.any(Date));
            return unchanged;
          }
          return user;
        },
      ),
      sessions: await tx.session.findMany({ orderBy: { id: "asc" } }),
      semesters: await tx.semester.findMany({ orderBy: { id: "asc" } }),
      courses: await tx.course.findMany(),
      sections: await tx.section.findMany({ include: { teachers: true } }),
      teachers: await tx.teacher.findMany(),
      descriptions: await tx.description.findMany(),
      edits: await tx.descriptionEdit.findMany(),
      homeworks: await tx.homework.findMany(),
      completions: await tx.homeworkCompletion.findMany(),
      todos: await tx.todo.findMany(),
      subscriptions: await tx.userSectionSubscription.findMany(),
      reactions: await tx.commentReaction.findMany(),
      uploads: await tx.upload.findMany(),
      pendingUploads: await tx.uploadPending.findMany(),
      attachments: await tx.commentAttachment.findMany(),
    }));
  const baseline = await stable();
  expect(baseline.users).toHaveLength(kind === "suspend" ? 2 : 1);
  expect(baseline.sessions).toHaveLength(1);
  expect(baseline.sessions[0].userId).toBe(actor.id);
  for (const user of baseline.users) expect(user.calendarFeedToken).toBeNull();
  expect(baseline.sections.map(({ id }) => id)).toEqual(
    section ? [section.id] : [],
  );
  for (const rows of [
    baseline.descriptions,
    baseline.edits,
    baseline.homeworks,
    baseline.completions,
    baseline.todos,
    baseline.subscriptions,
    baseline.reactions,
    baseline.uploads,
    baseline.pendingUploads,
    baseline.attachments,
  ])
    expect(rows).toEqual([]);
  expect(await db.comment.findMany()).toEqual([]);
  expect(await db.userSuspension.findMany()).toEqual([]);
  const sessionId = baseline.sessions[0].id;
  const ids = { comment: "", suspension: "" };
  const suspensionWindow = { start: Number.NaN, end: Number.NaN };
  let suspensionExpiresAt: Date | undefined;
  let aborted = 0;
  let held = 0;
  const browserWrites: { method: string; path: string; status: number }[] = [];
  const method =
    kind === "delete" ? "DELETE" : kind === "suspend" ? "POST" : "PATCH";
  const writePath = () =>
    kind === "suspend"
      ? "/api/admin/suspensions"
      : `/api/${kind === "delete" ? "community" : "admin"}/comments/${ids.comment}`;
  const refusedStatus = kind === "delete" ? 403 : 401;
  const successStatus = kind === "suspend" ? 201 : 200;
  const checks = {
    async verifyBrowserWrite(response, incoming) {
      await response.body();
      expect(incoming.method()).toBe(method);
      expect(new URL(incoming.url()).pathname).toBe(writePath());
      const index = browserWrites.length;
      browserWrites.push({
        method: incoming.method(),
        path: writePath(),
        status: response.status(),
      });
      expect(response.status()).toBe([refusedStatus, successStatus][index]);
      const body = await response.json();
      if (index === 0) {
        expect(body).toEqual(
          kind === "delete"
            ? { error: "Suspended", reason: marker }
            : { error: "Unauthorized" },
        );
        if (kind === "suspend")
          expect(await db.userSuspension.findMany()).toEqual([]);
        else
          expect(
            await db.comment.findUnique({ where: { id: ids.comment } }),
          ).toMatchObject({
            status: "active",
            deletedAt: null,
            moderatedAt: null,
          });
        return;
      }
      if (kind === "suspend") {
        const input = incoming.postDataJSON();
        expect(input).toEqual({
          userId: subject.id,
          reason: marker,
          expiresAt: expect.any(String),
        });
        const expiresAt = Date.parse(input.expiresAt);
        // The unchanged form defaults to three days. Validate independently of
        // the production expiration helper and before trusting the submitted value.
        expect(expiresAt).toBeGreaterThanOrEqual(
          suspensionWindow.start + 3 * 86_400_000,
        );
        expect(expiresAt).toBeLessThanOrEqual(
          suspensionWindow.end + 3 * 86_400_000,
        );
        suspensionExpiresAt = new Date(expiresAt);
        expect(body.suspension).toMatchObject({
          id: expect.any(String),
          userId: subject.id,
          createdById: actor.id,
          reason: marker,
          note: null,
          expiresAt: expect.any(String),
          liftedAt: null,
          liftedById: null,
        });
        expect(body.suspension.expiresAt).toMatch(/\+08:00$/);
        expect(Date.parse(body.suspension.expiresAt)).toBe(expiresAt);
        ids.suspension = body.suspension.id;
        expect(
          await db.userSuspension.findUnique({ where: { id: ids.suspension } }),
        ).toMatchObject({
          userId: subject.id,
          reason: marker,
          expiresAt: suspensionExpiresAt,
        });
      } else if (kind === "delete") {
        expect(body).toEqual({ success: true });
        expect(
          await db.comment.findUnique({ where: { id: ids.comment } }),
        ).toMatchObject({ status: "deleted", deletedAt: expect.any(Date) });
      } else {
        expect(incoming.postDataJSON()).toEqual({
          status: "softbanned",
          moderationNote: null,
        });
        expect(body.comment).toMatchObject({
          id: ids.comment,
          status: "softbanned",
          moderatedById: actor.id,
          moderationNote: null,
          deletedAt: null,
        });
        expect(
          await db.comment.findUnique({ where: { id: ids.comment } }),
        ).toMatchObject({
          status: "softbanned",
          moderatedAt: expect.any(Date),
          moderatedById: actor.id,
        });
      }
    },
    async verifyTransport({ producer, sdkRequests }) {
      expect(sdkRequests).toEqual([]);
      expect(producer.messages).toEqual([]);
      expect(producer.purges).toEqual([]);
      expect(aborted).toBe(1);
      expect(held).toBe(kind === "delete" ? 0 : 1);
      expect(browserWrites).toEqual([
        { method, path: writePath(), status: refusedStatus },
        { method, path: writePath(), status: successStatus },
      ]);
      expect(
        producer.requests
          .filter(({ value }) => value.method !== "GET")
          .map(({ value, result }) => [value.method, value.path, result]),
      ).toEqual([
        ["POST", "/api/account/preferences", 200],
        ...(kind === "suspend"
          ? []
          : [["POST", "/api/community/comments", 201]]),
        [method, writePath(), refusedStatus],
        [method, writePath(), successStatus],
      ]);
    },
    async verifyState() {
      expect(await stable()).toEqual(baseline);
      if (kind === "suspend") {
        expect(ids.suspension).not.toBe("");
        expect(await db.comment.findMany()).toEqual([]);
        expect(await db.userSuspension.findMany()).toEqual([
          {
            id: ids.suspension,
            userId: subject.id,
            createdById: actor.id,
            createdAt: expect.any(Date),
            reason: marker,
            note: null,
            expiresAt: suspensionExpiresAt,
            liftedAt: null,
            liftedById: null,
          },
        ]);
      } else {
        expect(ids.comment).not.toBe("");
        expect(await db.userSuspension.findMany()).toEqual([]);
        expect(await db.comment.findMany()).toEqual([
          {
            id: ids.comment,
            body: marker,
            visibility: "public",
            status: kind === "delete" ? "deleted" : "softbanned",
            isAnonymous: false,
            authorName: null,
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
            deletedAt: kind === "delete" ? expect.any(Date) : null,
            moderatedAt: kind === "moderate" ? expect.any(Date) : null,
            moderationNote: null,
            userId: actor.id,
            moderatedById: kind === "moderate" ? actor.id : null,
            parentId: null,
            rootId: ids.comment,
            sectionId: section?.id,
            courseId: null,
            teacherId: null,
            sectionTeacherId: null,
            homeworkId: null,
            youngEventId: null,
          },
        ]);
      }
      for (const rows of await Promise.all([
        db.oAuthClient.findMany(),
        db.oAuthConsent.findMany(),
        db.oAuthGrantUsageDaily.findMany(),
        db.oAuthAccessToken.findMany(),
        db.oAuthRefreshToken.findMany(),
        db.deviceCode.findMany(),
      ]))
        expect(rows).toEqual([]);
      const audits = await db.auditLog.findMany({
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
      const common = {
        outcome: "success",
        channel: "rest",
        userId: actor.id,
        subjectUserId: subject.id,
        oauthClientId: null,
        oauthGrantId: null,
      };
      const expected =
        kind === "suspend"
          ? [
              {
                ...common,
                action: "admin_user_suspend",
                targetId: subject.id,
                targetType: "user",
                sessionId: null,
                metadata: { reasonProvided: true },
              },
            ]
          : [
              {
                ...common,
                action: "comment_create",
                targetId: ids.comment,
                targetType: "comment",
                sessionId,
                metadata: null,
              },
              kind === "delete"
                ? {
                    ...common,
                    action: "comment_delete",
                    targetId: ids.comment,
                    targetType: "comment",
                    sessionId,
                    metadata: null,
                  }
                : {
                    ...common,
                    action: "admin_comment_moderate",
                    targetId: ids.comment,
                    targetType: "comment",
                    sessionId: null,
                    metadata: {
                      status: "softbanned",
                      moderationNoteProvided: false,
                    },
                  },
            ];
      expect(audits).toHaveLength(kind === "suspend" ? 1 : 2);
      expect(audits).toEqual(expect.arrayContaining(expected));
    },
  } satisfies CommunityChecks;
  return {
    db,
    marker,
    actor,
    subject,
    ids,
    suspensionWindow,
    checks,
    clearRoutes: () => flow.clearRoutes(page),
    async abortNextWrite() {
      await flow.route(
        page,
        (url) => url.pathname === writePath(),
        async (route) => {
          if (route.request().method() !== method) return route.fallback();
          aborted += 1;
          await route.abort("failed");
        },
      );
    },
    async holdNextWrite() {
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let intercepted!: () => void;
      const started = new Promise<void>((resolve) => {
        intercepted = resolve;
      });
      flow.onClosing(release);
      await flow.route(
        page,
        (url) => url.pathname === writePath(),
        async (route) => {
          if (route.request().method() !== method) return route.fallback();
          held += 1;
          intercepted();
          await pending;
          // The existing proxy owns the genuine fetch, response and verifier.
          await route.fallback();
        },
      );
      return { started, release };
    },
  };
}

type DestructiveSecurity = Awaited<
  ReturnType<typeof prepareDestructiveSecurity>
>;
type CommentSecurity = DestructiveSecurity & { section: Section };
export const test = communityTest.extend<{
  deletionAnnouncementRun: (
    work: (fixture: CommentSecurity) => Promise<void>,
  ) => Promise<void>;
  suspensionAnnouncementRun: (
    work: (fixture: DestructiveSecurity) => Promise<void>,
  ) => Promise<void>;
  moderationAnnouncementRun: (
    work: (fixture: CommentSecurity) => Promise<void>,
  ) => Promise<void>;
}>({
  deletionAnnouncementRun: async (
    { page, isolatedWorker, communityFlow, account, community },
    use,
  ) => {
    await use(async (work) => {
      let fixture: DestructiveSecurity;
      await communityFlow.run(
        async () => {
          fixture = await prepareDestructiveSecurity(
            "delete",
            page,
            isolatedWorker,
            communityFlow,
            account,
            community.section,
          );
          await work({ ...fixture, section: community.section });
        },
        { auditActions: { comment_create: 1, comment_delete: 1 } },
        {
          verifyBrowserWrite: (response, incoming) =>
            fixture.checks.verifyBrowserWrite(response, incoming),
          verifyTransport: (observation) =>
            fixture.checks.verifyTransport(observation),
          verifyState: () => fixture.checks.verifyState(),
        },
      );
    });
  },
  suspensionAnnouncementRun: async (
    { page, isolatedWorker, communityFlow, account },
    use,
  ) => {
    await use(async (work) => {
      let fixture: DestructiveSecurity;
      await communityFlow.run(
        async () => {
          fixture = await prepareDestructiveSecurity(
            "suspend",
            page,
            isolatedWorker,
            communityFlow,
            account,
          );
          await work(fixture);
        },
        { auditActions: { admin_user_suspend: 1 } },
        {
          verifyBrowserWrite: (response, incoming) =>
            fixture.checks.verifyBrowserWrite(response, incoming),
          verifyTransport: (observation) =>
            fixture.checks.verifyTransport(observation),
          verifyState: () => fixture.checks.verifyState(),
        },
      );
    });
  },
  moderationAnnouncementRun: async (
    { page, isolatedWorker, communityFlow, account, community },
    use,
  ) => {
    await use(async (work) => {
      let fixture: DestructiveSecurity;
      await communityFlow.run(
        async () => {
          fixture = await prepareDestructiveSecurity(
            "moderate",
            page,
            isolatedWorker,
            communityFlow,
            account,
            community.section,
          );
          await work({ ...fixture, section: community.section });
        },
        { auditActions: { comment_create: 1, admin_comment_moderate: 1 } },
        {
          verifyBrowserWrite: (response, incoming) =>
            fixture.checks.verifyBrowserWrite(response, incoming),
          verifyTransport: (observation) =>
            fixture.checks.verifyTransport(observation),
          verifyState: () => fixture.checks.verifyState(),
        },
      );
    });
  },
});
