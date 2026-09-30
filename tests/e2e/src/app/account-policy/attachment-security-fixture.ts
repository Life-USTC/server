import { expect, type Page } from "@playwright/test";
import type { User } from "@/generated/prisma-node/client";
import { test as communityTest } from "../../../utils/community-fixture";
import type {
  CommunityChecks,
  CommunityFlow,
} from "../../../utils/community-flow";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import { createUploadBucket } from "../../../utils/upload-bucket";

async function prepareAttachmentSecurity(
  page: Page,
  worker: IsolatedWorker,
  flow: CommunityFlow,
  owner: User,
  section: { id: number; jwId: number },
  bucket: ReturnType<typeof createUploadBucket>,
) {
  const db = worker.database.owner;
  const marker = `attachment-policy-${crypto.randomUUID()}`;
  const contents = `${marker}: exact private object bytes`;
  const peers = await db.$transaction(async (tx) => {
    const create = (role: "viewer" | "admin") =>
      tx.user.create({
        data: {
          id: crypto.randomUUID(),
          name: `Attachment ${role}`,
          username: `${role}${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
          email: `${marker}-${role}@example.test`,
          isAdmin: role === "admin",
        },
      });
    return { viewer: await create("viewer"), admin: await create("admin") };
  });
  const viewerSession = await worker.createSession(peers.viewer.id);
  const adminSession = await worker.createSession(peers.admin.id);
  const ownedUserIds = [owner.id, peers.viewer.id, peers.admin.id];
  // These cases exercise attachment policy; session refresh has its own oracle.
  const sessionTime = new Date();
  await db.session.updateMany({
    where: { userId: { in: ownedUserIds } },
    data: {
      expires: new Date(sessionTime.getTime() + 30 * 86_400_000),
      updatedAt: sessionTime,
    },
  });
  const viewerContext = await flow.newContext();
  await viewerContext.addCookies([viewerSession.cookie]);
  const adminContext = await flow.newContext();
  await adminContext.addCookies([adminSession.cookie]);
  const anonymousContext = await flow.newContext();
  const actors = {
    owner: page.request,
    viewer: viewerContext.request,
    admin: adminContext.request,
    anonymous: anonymousContext.request,
  };
  const stable = () =>
    db.$transaction(async (tx) => ({
      users: await tx.user.findMany({ orderBy: { id: "asc" } }),
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
      suspensions: await tx.userSuspension.findMany(),
      reactions: await tx.commentReaction.findMany(),
    }));
  const baseline = await stable();
  expect(baseline.users).toHaveLength(3);
  expect(baseline.sessions).toHaveLength(3);
  expect(baseline.sections.map(({ id }) => id)).toEqual([section.id]);
  for (const user of baseline.users) expect(user.calendarFeedToken).toBeNull();
  for (const rows of [
    baseline.descriptions,
    baseline.edits,
    baseline.homeworks,
    baseline.completions,
    baseline.todos,
    baseline.subscriptions,
    baseline.suspensions,
    baseline.reactions,
  ])
    expect(rows).toEqual([]);
  expect(await db.comment.findMany()).toEqual([]);
  expect(await db.upload.findMany()).toEqual([]);
  expect(await db.uploadPending.findMany()).toEqual([]);
  expect(await db.commentAttachment.findMany()).toEqual([]);
  for (const userId of ownedUserIds)
    expect(await bucket.list({ prefix: `${userId}/` })).toMatchObject({
      objects: [],
      truncated: false,
    });
  const ownerSessionId = baseline.sessions.find(
    ({ userId }) => userId === owner.id,
  )?.id;
  expect(ownerSessionId).toEqual(expect.any(String));
  const ids = { upload: "", key: "", comment: "" };
  const checks: CommunityChecks = {
    async verifyTransport({ producer, sdkRequests }) {
      expect(sdkRequests).toEqual([]);
      expect(producer.messages).toEqual([]);
      expect(producer.purges).toEqual([]);
      const expectedWrites = [
        ["POST", "/api/workspace/uploads", 200],
        ["PUT", "/api/workspace/uploads/object", 200],
        ["POST", "/api/workspace/uploads/complete", 200],
        ["POST", "/api/community/comments", 201],
        ["PATCH", `/api/community/comments/${ids.comment}`, 200],
        ["PATCH", `/api/admin/comments/${ids.comment}`, 200],
        ["PATCH", `/api/admin/comments/${ids.comment}`, 200],
        ["DELETE", `/api/community/comments/${ids.comment}`, 200],
        ["DELETE", `/api/workspace/uploads/${ids.upload}`, 200],
      ];
      expect(
        producer.requests
          .filter(({ value }) => value.method !== "GET")
          .map(({ value, result }) => [value.method, value.path, result]),
      ).toEqual(expectedWrites);
      // Query strings are intentionally absent from the native probe. The case
      // separately checks every download/preview pair and its response bytes.
      const downloads = producer.requests.filter(
        ({ value }) =>
          value.method === "GET" &&
          value.path === `/api/workspace/uploads/${ids.upload}/download`,
      );
      expect(downloads).toHaveLength(56);
      expect(downloads.filter(({ result }) => result === 200)).toHaveLength(26);
      expect(downloads.filter(({ result }) => result === 404)).toHaveLength(16);
      expect(downloads.filter(({ result }) => result === 401)).toHaveLength(14);
      expect(producer.requests).toHaveLength(65);
    },
    async verifyState() {
      expect(await stable()).toEqual(baseline);
      expect(ids.upload).not.toBe("");
      expect(ids.comment).not.toBe("");
      expect(await db.comment.findMany()).toEqual([
        {
          id: ids.comment,
          body: marker,
          visibility: "logged_in_only",
          status: "deleted",
          isAnonymous: false,
          authorName: null,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
          deletedAt: expect.any(Date),
          moderatedAt: expect.any(Date),
          moderationNote: marker,
          userId: owner.id,
          moderatedById: peers.admin.id,
          parentId: null,
          rootId: ids.comment,
          sectionId: section.id,
          courseId: null,
          teacherId: null,
          sectionTeacherId: null,
          homeworkId: null,
          youngEventId: null,
        },
      ]);
      expect(await db.upload.findMany()).toEqual([]);
      expect(await db.uploadPending.findMany()).toEqual([]);
      expect(await db.commentAttachment.findMany()).toEqual([]);
      expect(await bucket.get(ids.key)).toBeNull();
      for (const userId of ownedUserIds)
        expect(await bucket.list({ prefix: `${userId}/` })).toMatchObject({
          objects: [],
          truncated: false,
        });
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
        subjectUserId: owner.id,
        oauthClientId: null,
        oauthGrantId: null,
      };
      const expected = [
        ...["comment_create", "comment_edit", "comment_delete"].map(
          (action) => ({
            ...common,
            action,
            userId: owner.id,
            targetId: ids.comment,
            targetType: "comment",
            sessionId: ownerSessionId,
            metadata: null,
          }),
        ),
        ...["softbanned", "active"].map((status) => ({
          ...common,
          action: "admin_comment_moderate",
          userId: peers.admin.id,
          targetId: ids.comment,
          targetType: "comment",
          sessionId: null,
          metadata: { status, moderationNoteProvided: true },
        })),
        {
          ...common,
          action: "upload_delete",
          userId: owner.id,
          targetId: ids.upload,
          targetType: "upload",
          sessionId: ownerSessionId,
          metadata: { size: Buffer.byteLength(contents) },
        },
      ];
      expect(audits).toHaveLength(6);
      expect(audits).toEqual(expect.arrayContaining(expected));
    },
  };
  return {
    db,
    marker,
    contents,
    owner,
    ...peers,
    actors,
    section,
    ids,
    checks,
  };
}

type AttachmentSecurity = Awaited<ReturnType<typeof prepareAttachmentSecurity>>;
export const test = communityTest.extend<{
  attachmentSecurityRun: (
    work: (fixture: AttachmentSecurity) => Promise<void>,
  ) => Promise<void>;
}>({
  attachmentSecurityRun: async (
    { page, request, isolatedWorker, communityFlow, account, community },
    use,
  ) => {
    await use(async (work) => {
      let fixture: AttachmentSecurity;
      await communityFlow.run(
        async () => {
          fixture = await prepareAttachmentSecurity(
            page,
            isolatedWorker,
            communityFlow,
            account,
            community.section,
            createUploadBucket(request, isolatedWorker.origin),
          );
          await work(fixture);
        },
        {
          auditActions: {
            comment_create: 1,
            comment_edit: 1,
            comment_delete: 1,
            upload_delete: 1,
          },
        },
        {
          verifyTransport: (observation) =>
            fixture.checks.verifyTransport(observation),
          verifyState: () => fixture.checks.verifyState(),
        },
      );
    });
  },
});
