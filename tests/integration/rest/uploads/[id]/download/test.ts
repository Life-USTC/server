import { expect } from "@playwright/test";
import { base, test as uploadTest } from "../../_fixture";

const test = uploadTest.extend<{ attachmentTarget: number }>({
  attachmentTarget: async ({ uploadState, run }, use) => {
    const { db } = uploadState;
    const section = await run(() =>
      db.section.create({
        data: {
          code: "private-upload-attachment-target",
          jwId: 1_800_000_001,
          course: {
            create: {
              code: "private-upload-course",
              jwId: 1_800_000_000,
              nameCn: "Private attachment course",
            },
          },
        },
      }),
    );
    await use(section.id);
  },
});
const path = (id: string) => `${base}/${id}/download`;

test("anonymous download returns JSON 401", async ({
  run,
  request,
  uploadState,
}) => {
  await run(async () => {
    const upload = await uploadState.knownUpload();
    const response = await request.get(path(upload.id));
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("known owned upload streams exact bytes with content type and filename", async ({
  run,
  uploadState,
}) => {
  await run(async () => {
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
});

for (const isAdmin of [false, true]) {
  test(`non-owner ${isAdmin ? "admin" : "user"} cannot download an unattached upload`, async ({
    run,
    createActor,
    uploadState,
  }) => {
    await run(async () => {
      const actor = await createActor({ isAdmin });
      const upload = await uploadState.knownUpload();
      expect((await actor.request.get(path(upload.id))).status()).toBe(404);
    });
  });
}

for (const deleted of [false, true]) {
  for (const isAdmin of [false, true]) {
    test(`${isAdmin ? "admin" : "user"} ${deleted ? "cannot download deleted" : "can download public"} comment attachment`, async ({
      run,
      createActor,
      uploadState,
      attachmentTarget,
    }) => {
      await run(async () => {
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
    });
  }
}

for (const missing of ["metadata", "storage object"] as const) {
  test(`download returns 404 for missing ${missing}`, async ({
    run,
    uploadState,
  }) => {
    await run(async () => {
      const { db, owner, bucket, knownUpload } = uploadState;
      const upload = await knownUpload();
      if (missing === "metadata")
        await db.upload.delete({ where: { id: upload.id } });
      else await bucket.delete(upload.key);
      const response = await owner.request.get(path(upload.id));
      expect(response.status()).toBe(404);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(await db.upload.findUnique({ where: { id: upload.id } })).toEqual(
        missing === "metadata"
          ? null
          : expect.objectContaining({ id: upload.id }),
      );
      expect(await bucket.head(upload.key)).toEqual(
        missing === "storage object"
          ? null
          : expect.objectContaining({ size: upload.size }),
      );
    });
  });
}
