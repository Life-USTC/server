import { createDeferred } from "../../shared/deferred";
import type { TestPrismaClient } from "../../shared/prisma";
import { withBrowserWorkflow } from "./browser-workflow";
import type { IsolatedWorker } from "./isolated-worker";
import { test as workerTest } from "./owned-worker";
import { withSettledPageWrites } from "./settled-page-writes";
import { createUploadedFileViaApi } from "./uploads";

export const PRIORITY_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1sAAAAASUVORK5CYII=";
async function createCommunityPriorityFixture(isolatedWorker: IsolatedWorker) {
  const owner = isolatedWorker.database.owner;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const daysAgo = (days: number) =>
    new Date(today.getTime() - days * 86_400_000);
  const f = await owner.$transaction(async (db) => {
    const marker = crypto.randomUUID();
    const n = 1_600_000_000 + Math.floor(Math.random() * 100_000_000);
    const author = await db.user.create({
      data: {
        name: "Priority community author",
        username: `pc${marker.replaceAll("-", "").slice(0, 20)}`,
        email: `priority-community-${marker}@example.test`,
        emailVerified: true,
        image: PRIORITY_AVATAR,
        createdAt: new Date("2026-01-02T00:00:00Z"),
      },
    });
    const course = await db.course.create({
      data: {
        jwId: n,
        code: "COMMUNITY",
        nameCn: "社区优先级课程",
        nameEn: "Community priority course",
      },
    });
    const section = await db.section.create({
      data: { jwId: n + 1, courseId: course.id, code: "COMMUNITY.01" },
    });
    const comment = await db.comment.create({
      data: {
        userId: author.id,
        courseId: course.id,
        body: "Priority community comment",
        visibility: "logged_in_only",
        status: "softbanned",
        createdAt: daysAgo(3),
        updatedAt: daysAgo(2),
      },
    });
    await db.commentReaction.create({
      data: { userId: author.id, commentId: comment.id, type: "heart" },
    });
    const description = await db.description.create({
      data: {
        courseId: course.id,
        content: "Priority community description",
        lastEditedById: author.id,
        lastEditedAt: new Date("2026-02-05T00:00:00Z"),
        updatedAt: new Date("2026-02-07T00:00:00Z"),
      },
    });
    const edit = await db.descriptionEdit.create({
      data: {
        descriptionId: description.id,
        editorId: author.id,
        previousContent: "Earlier community description",
        nextContent: description.content,
        createdAt: new Date("2026-02-05T00:00:00Z"),
      },
    });
    const homework = await db.homework.create({
      data: {
        sectionId: section.id,
        createdById: author.id,
        title: "Community priority homework",
        createdAt: daysAgo(1),
      },
    });
    return { author, course, section, comment, description, edit, homework };
  });
  const session = await isolatedWorker.createSession(f.author.id);
  const uploaded = await createUploadedFileViaApi(session.request, {
    filename: "community-material.txt",
    contents: "Community priority attachment",
  });
  const upload = await owner.$transaction(async (db) => {
    const upload = await db.upload.update({
      where: { id: uploaded.uploadId },
      data: { createdAt: today },
    });
    await db.commentAttachment.create({
      data: { uploadId: upload.id, commentId: f.comment.id },
    });
    return upload;
  });
  return { ...f, upload };
}
export type CommunityPriorityFixture = Awaited<
  ReturnType<typeof createCommunityPriorityFixture>
>;

export const test = workerTest.extend<{
  communityPriority: CommunityPriorityFixture;
  communityPriorityDb: <T>(
    work: (db: TestPrismaClient) => Promise<T>,
  ) => Promise<T>;
  communityPriorityRun: (work: () => Promise<void>) => Promise<void>;
  communityUploadGate: { promise: Promise<void>; resolve: () => void };
}>({
  communityPriority: async ({ isolatedWorker, run }, use) => {
    await use(await run(() => createCommunityPriorityFixture(isolatedWorker)));
  },
  communityPriorityDb: async ({ isolatedWorker, run }, use) => {
    await use((work) => run(() => work(isolatedWorker.database.owner)));
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads fixture dependencies.
  communityUploadGate: async ({}, use) => {
    await use(createDeferred());
  },
  communityPriorityRun: async (
    {
      page,
      isolatedWorker,
      communityPriority: _community,
      communityUploadGate,
      run,
    },
    use,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withSettledPageWrites(
              page,
              (url) => url.origin === isolatedWorker.origin,
              async () => {
                try {
                  await workflow.body(work);
                } finally {
                  // Both an assertion failure and native fixture interruption
                  // release the admitted PUT before write cleanup joins it.
                  communityUploadGate.resolve();
                }
              },
              undefined,
              async (request) => {
                if (
                  request.method() === "PUT" &&
                  new URL(request.url()).pathname ===
                    "/api/workspace/uploads/object"
                )
                  await communityUploadGate.promise;
              },
            ),
          ),
        ),
      );
    });
  },
});
