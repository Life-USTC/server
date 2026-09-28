import { mergeTests } from "@playwright/test";
import type {
  CommentAttachment,
  Section,
  Upload,
  UploadPending,
  User,
} from "../../../src/generated/prisma-node/client";
import { test as storageTest } from "../../integration/rest/uploads/_fixture";
import type { TestPrismaClient } from "../../shared/prisma";
import { test as workerTest } from "./isolated-worker";
import { withSettledPageWrites } from "./settled-page-writes";

type UploadSnapshot = {
  uploads: Upload[];
  pending: UploadPending[];
  attachments: CommentAttachment[];
  objects: { key: string; body: number[] }[];
};
type UploadStep = { path: string; status: number; state: UploadSnapshot };

const combined = mergeTests(storageTest, workerTest);
export const test = combined.extend<{
  account: User;
  community: { section: Section };
  upload: {
    prefix: string;
    steps: UploadStep[];
    observe: () => Promise<UploadSnapshot>;
  };
}>({
  account: async ({ isolatedWorker, page }, use) => {
    const actor = await isolatedWorker.createActor();
    await page.context().addCookies([actor.cookie]);
    await use(
      await isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      }),
    );
  },
  community: async ({ isolatedWorker, page, upload }, use) => {
    const section = await isolatedWorker.database.owner.$transaction(
      async (db) => {
        const semester = await db.semester.create({
          data: { jwId: 1, code: "421", nameCn: "2026年春季学期" },
        });
        const course = await db.course.create({
          data: {
            jwId: 1,
            code: "CM1",
            nameCn: "独立社区课程",
            nameEn: "Independent community course",
          },
        });
        const teacher = await db.teacher.create({
          data: {
            jwId: -1,
            nameCn: "社区教师",
            nameEn: "Community teacher",
          },
        });
        return db.section.create({
          data: {
            jwId: 1,
            code: "CM1.01",
            courseId: course.id,
            semesterId: semester.id,
            teachers: { connect: { id: teacher.id } },
          },
        });
      },
    );
    // One owner drains comments and uploads, including their response observer,
    // before closing the page and disposing the private Worker.
    await withSettledPageWrites(
      page,
      (url) =>
        url.pathname === "/api/community/comments" ||
        url.pathname.startsWith("/api/community/comments/") ||
        /^\/api\/workspace\/uploads(?:\/(?:object|complete))?$/.test(
          url.pathname,
        ),
      () => use({ section }),
      async (response, request) => {
        const path = new URL(request.url()).pathname;
        if (!path.startsWith("/api/workspace/uploads")) return;
        // Observe every persisted upload phase before the browser can start
        // the next phase. Teardown awaits this observer too.
        upload.steps.push({
          path,
          status: response.status(),
          state: await upload.observe(),
        });
      },
    );
  },
  upload: async ({ account, isolatedWorker, uploadBucket: bucket }, use) => {
    const db = isolatedWorker.database.owner;
    const prefix = `uploads/${account.id}/`;
    const observe = async (): Promise<UploadSnapshot> => {
      const data = {
        uploads: await db.upload.findMany({ where: { userId: account.id } }),
        pending: await db.uploadPending.findMany({
          where: { userId: account.id },
        }),
        attachments: await db.commentAttachment.findMany({
          where: { upload: { userId: account.id } },
        }),
      };
      const objects: UploadSnapshot["objects"] = [];
      let cursor: string | undefined;
      do {
        const result = await bucket.list({
          prefix,
          ...(cursor ? { cursor } : {}),
        });
        for (const { key } of result.objects) {
          const object = await bucket.get(key);
          if (!object)
            throw new Error(
              `Owned object ${key} disappeared during observation`,
            );
          objects.push({ key, body: Array.from(object.body) });
        }
        cursor = result.truncated ? result.cursor : undefined;
      } while (cursor);
      return { ...data, objects };
    };
    await use({ prefix, steps: [], observe });
    // The private Worker owns all rows, deferred writes, and storage. Stopping
    // it isolates those effects; it does not prove queued consumers completed.
  },
});

export function storedComment(db: TestPrismaClient, id: string) {
  return db.comment.findUnique({ where: { id }, include: { reactions: true } });
}
