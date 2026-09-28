import { expect } from "@playwright/test";
import { DEV_SEED } from "../../../../../fixtures/dev-seed";
import { base, test as uploadTest } from "../../_fixture";

const test = uploadTest.extend<{ attachmentTarget: number }>({
  attachmentTarget: async ({ uploadState }, use) => {
    const { db } = uploadState;
    const code = `upload-target-${crypto.randomUUID()}`;
    try {
      const source = await db.section.findUniqueOrThrow({
        where: { jwId: DEV_SEED.section.jwId },
        select: { courseId: true, semesterId: true },
      });
      const section = await db.section.create({
        data: {
          ...source,
          code,
          jwId: 1_800_000_000 + Math.floor(Math.random() * 100_000_000),
        },
      });
      await use(section.id);
    } finally {
      await db.section.deleteMany({ where: { code } });
    }
  },
});
const path = (id: string) => `${base}/${id}/download`;

test("anonymous download returns JSON 401", async ({
  request,
  uploadState,
}) => {
  const upload = await uploadState.knownUpload();
  const response = await request.get(path(upload.id));
  expect(response.status()).toBe(401);
  expect((await response.json()).error).toEqual(expect.any(String));
});

test("known owned upload streams exact bytes with content type and filename", async ({
  uploadState,
}) => {
  const { owner, knownUpload } = uploadState;
  const upload = await knownUpload({
    filename: "download.txt",
    contents: "download test content",
  });
  const response = await owner.request.get(path(upload.id));
  expect(response.status()).toBe(200);
  expect(response.headers()["content-disposition"]).toContain("download.txt");
  expect(response.headers()["content-type"]).toContain("text/plain");
  expect(await response.text()).toBe("download test content");
});

for (const isAdmin of [false, true]) {
  test(`non-owner ${isAdmin ? "admin" : "user"} cannot download an unattached upload`, async ({
    createActor,
    uploadState,
  }) => {
    const actor = await createActor({ isAdmin });
    const upload = await uploadState.knownUpload();
    expect((await actor.request.get(path(upload.id))).status()).toBe(404);
  });
}

for (const deleted of [false, true]) {
  for (const isAdmin of [false, true]) {
    test(`${isAdmin ? "admin" : "user"} ${deleted ? "cannot download deleted" : "can download public"} comment attachment`, async ({
      createActor,
      uploadState,
      attachmentTarget,
    }) => {
      const { db, owner, knownUpload, bucket } = uploadState;
      const actor = await createActor({ isAdmin });
      const upload = await knownUpload({ contents: "comment attachment" });
      await db.comment.create({
        data: {
          userId: owner.id,
          body: "attachment comment",
          sectionId: attachmentTarget,
          visibility: "public",
          status: deleted ? "deleted" : "active",
          ...(deleted ? { deletedAt: new Date() } : {}),
          attachments: { create: { uploadId: upload.id } },
        },
      });
      const response = await actor.request.get(path(upload.id));
      expect(response.status()).toBe(deleted ? 404 : 200);
      if (!deleted) expect(await response.text()).toBe("comment attachment");
      expect(
        await db.upload.findUniqueOrThrow({ where: { id: upload.id } }),
      ).toMatchObject({ userId: owner.id });
      expect(
        await new Response((await bucket.get(upload.key))?.body).text(),
      ).toBe("comment attachment");
    });
  }
}

test("download returns 404 for unknown metadata or a missing storage object", async ({
  uploadState,
}) => {
  const { owner, bucket, knownUpload } = uploadState;
  expect((await owner.request.get(path(crypto.randomUUID()))).status()).toBe(
    404,
  );
  const upload = await knownUpload();
  await bucket.delete(upload.key);
  expect((await owner.request.get(path(upload.id))).status()).toBe(404);
});
