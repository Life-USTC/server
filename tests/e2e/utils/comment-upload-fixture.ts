import { expect } from "@playwright/test";
import type {
  CommentAttachment,
  Section,
  Upload,
  UploadPending,
  User,
} from "../../../src/generated/prisma-node/client";
import { test as storageTest } from "../../integration/rest/uploads/_fixture";
import type { TestPrismaClient } from "../../shared/prisma";
import { type CommunityFlow, withCommunityFlow } from "./community-flow";

type UploadSnapshot = {
  uploads: Upload[];
  pending: UploadPending[];
  attachments: CommentAttachment[];
  objects: { key: string; body: number[] }[];
};
type UploadStep = { path: string; status: number; state: UploadSnapshot };

type CommentWrite =
  | "create"
  | "reaction"
  | "edit"
  | "delete"
  | "upload-reserve"
  | "upload-object"
  | "upload-complete";

export const test = storageTest.extend<{
  commentFlow: CommunityFlow;
  commentRun: (
    plan: { writes: CommentWrite[]; auditActions: Record<string, number> },
    work: () => Promise<void>,
  ) => Promise<void>;
  account: User;
  community: { section: Section };
  upload: {
    prefix: string;
    steps: UploadStep[];
    observe: () => Promise<UploadSnapshot>;
  };
}>({
  account: async ({ isolatedWorker, page, run }, use) => {
    const account = await run(async () => {
      const actor = await isolatedWorker.createActor();
      await page.context().addCookies([actor.cookie]);
      return isolatedWorker.database.owner.user.findUniqueOrThrow({
        where: { id: actor.id },
      });
    });
    await use(account);
  },
  community: async ({ isolatedWorker, run }, use) => {
    const section = await run(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
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
      }),
    );
    await use({ section });
  },
  commentFlow: async (
    { page, browser, request, isolatedWorker, account },
    use,
  ) => {
    await withCommunityFlow(
      { page, browser, observer: request, isolatedWorker, account },
      use,
    );
  },
  commentRun: async (
    { commentFlow, isolatedWorker, account, upload, run },
    use,
  ) => {
    const db = isolatedWorker.database.owner;
    await use((plan, work) =>
      run(async () => {
        const observed: { method: string; path: string; status: number }[] = [];
        await commentFlow.run(
          work,
          { auditActions: plan.auditActions },
          {
            verifyBrowserWrite: async (response, request) => {
              const kind = plan.writes[observed.length];
              if (!kind) throw new Error("Unexpected section comment write");
              const path = new URL(request.url()).pathname;
              const method = request.method();
              observed.push({ method, path, status: response.status() });
              if (kind.startsWith("upload-")) {
                const expected = {
                  "upload-reserve": {
                    path: "/api/workspace/uploads",
                    method: "POST",
                  },
                  "upload-object": {
                    path: "/api/workspace/uploads/object",
                    method: "PUT",
                  },
                  "upload-complete": {
                    path: "/api/workspace/uploads/complete",
                    method: "POST",
                  },
                }[
                  kind as "upload-reserve" | "upload-object" | "upload-complete"
                ];
                expect({ method, path }).toEqual(expected);
                expect(response.status()).toBe(200);
                // Read actual R2 bytes and persisted metadata before delivering each
                // phase to the browser. The original case supplies its exact oracle.
                upload.steps.push({
                  path,
                  status: response.status(),
                  state: await upload.observe(),
                });
                return;
              }
              const body = await response.json();
              if (kind === "create") {
                expect({ method, path }).toEqual({
                  method: "POST",
                  path: "/api/community/comments",
                });
                expect(response.status()).toBe(201);
                expect(body.id).toEqual(expect.any(String));
                const input = request.postDataJSON();
                expect(await storedComment(db, body.id)).toMatchObject({
                  userId: account.id,
                  body: input.body,
                  status: "active",
                });
              } else if (kind === "reaction") {
                expect(method).toBe("POST");
                expect(path).toMatch(
                  /^\/api\/community\/comments\/[^/]+\/reactions$/,
                );
                expect(response.status()).toBe(200);
                expect(body).toEqual({ success: true });
                const id = decodeURIComponent(path.split("/")[4]);
                expect((await storedComment(db, id))?.reactions).toEqual([
                  expect.objectContaining({
                    userId: account.id,
                    type: "upvote",
                  }),
                ]);
              } else {
                expect(path).toMatch(/^\/api\/community\/comments\/[^/]+$/);
                expect(response.status()).toBe(200);
                expect(body.success).toBe(true);
                const id = decodeURIComponent(path.split("/")[4]);
                if (kind === "delete") {
                  expect(method).toBe("DELETE");
                  expect(await storedComment(db, id)).toMatchObject({
                    userId: account.id,
                    status: "deleted",
                    deletedAt: expect.any(Date),
                  });
                } else {
                  expect(kind).toBe("edit");
                  expect(method).toBe("PATCH");
                  const input = request.postDataJSON();
                  expect(body.comment).toMatchObject({ id, body: input.body });
                  expect(await storedComment(db, id)).toMatchObject({
                    userId: account.id,
                    body: input.body,
                    status: "active",
                  });
                }
              }
            },
            verifyTransport: async ({ producer, sdkRequests }) => {
              expect(sdkRequests).toEqual([]);
              expect(
                producer.requests
                  .filter((entry) =>
                    ["POST", "PUT", "PATCH", "DELETE"].includes(
                      entry.value.method,
                    ),
                  )
                  .map((entry) => ({
                    method: entry.value.method,
                    path: entry.value.path,
                    status: entry.result,
                  })),
              ).toEqual(observed);
            },
            verifyState: async () => {
              expect(observed).toHaveLength(plan.writes.length);
            },
          },
        );
      }),
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
