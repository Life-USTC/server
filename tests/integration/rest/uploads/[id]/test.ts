import { expect } from "@playwright/test";
import { base, test } from "../_fixture";

for (const method of ["patch", "delete"] as const) {
  test(`anonymous upload ${method} returns JSON 401 without changing metadata or bytes`, async ({
    run,
    request,
    uploadState,
  }) => {
    await run(async () => {
      const { db, knownUpload, bucket } = uploadState;
      const upload = await knownUpload();
      const before = await db.upload.findUniqueOrThrow({
        where: { id: upload.id },
      });
      const response = await request[method](`${base}/${upload.id}`, {
        data: { filename: "denied.txt" },
      });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(
        await db.upload.findUniqueOrThrow({ where: { id: upload.id } }),
      ).toEqual(before);
      expect(
        await new Response((await bucket.get(upload.key))?.body).text(),
      ).toBe(upload.contents);
    });
  });

  for (const isAdmin of [false, true]) {
    test(`non-owner ${isAdmin ? "admin" : "user"} cannot ${method} an upload`, async ({
      run,
      createActor,
      uploadState,
    }) => {
      await run(async () => {
        const { db, knownUpload, bucket } = uploadState;
        const actor = await createActor({ isAdmin });
        const upload = await knownUpload();
        const before = await db.upload.findUniqueOrThrow({
          where: { id: upload.id },
        });
        const response = await actor.request[method](`${base}/${upload.id}`, {
          data: { filename: "denied.txt" },
        });
        expect(response.status()).toBe(404);
        expect(
          await db.upload.findUniqueOrThrow({ where: { id: upload.id } }),
        ).toEqual(before);
        expect(
          await new Response((await bucket.get(upload.key))?.body).text(),
        ).toBe(upload.contents);
      });
    });
  }
}

test("rename changes only metadata and the subsequent download filename", async ({
  run,
  uploadState,
}) => {
  await run(async () => {
    const { db, owner, knownUpload, bucket } = uploadState;
    const upload = await knownUpload();
    const response = await owner.request.patch(`${base}/${upload.id}`, {
      data: { filename: "renamed.txt" },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      upload: { id: upload.id, filename: "renamed.txt" },
    });
    expect(
      await db.upload.findUniqueOrThrow({ where: { id: upload.id } }),
    ).toMatchObject({
      filename: "renamed.txt",
      key: upload.key,
      size: upload.size,
      userId: owner.id,
    });
    expect(
      await new Response((await bucket.get(upload.key))?.body).text(),
    ).toBe(upload.contents);
    const download = await owner.request.get(`${base}/${upload.id}/download`);
    expect(download.status()).toBe(200);
    expect(download.headers()["content-disposition"]).toContain("renamed.txt");
    expect(await download.text()).toBe(upload.contents);
  });
});

test("empty rename leaves metadata and bytes unchanged", async ({
  run,
  uploadState,
}) => {
  await run(async () => {
    const { db, owner, knownUpload, bucket } = uploadState;
    const upload = await knownUpload();
    const before = await db.upload.findUniqueOrThrow({
      where: { id: upload.id },
    });
    const response = await owner.request.patch(`${base}/${upload.id}`, {
      data: { filename: "" },
    });
    expect(response.status()).toBe(400);
    expect(
      await db.upload.findUniqueOrThrow({ where: { id: upload.id } }),
    ).toEqual(before);
    expect(
      await new Response((await bucket.get(upload.key))?.body).text(),
    ).toBe(upload.contents);
  });
});

test("delete removes the object and metadata, reports exact size and disappears from the list", async ({
  run,
  uploadState,
}) => {
  await run(async () => {
    const { db, owner, other, knownUpload, bucket } = uploadState;
    const upload = await knownUpload();
    const foreign = await knownUpload({
      userId: other.id,
      contents: "foreign bytes",
    });
    const response = await owner.request.delete(`${base}/${upload.id}`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      deletedId: upload.id,
      deletedSize: upload.size,
    });
    expect(await db.upload.findUnique({ where: { id: upload.id } })).toBeNull();
    expect(await bucket.head(upload.key)).toBeNull();
    expect(
      await db.upload.findUniqueOrThrow({ where: { id: foreign.id } }),
    ).toMatchObject({ userId: other.id });
    expect(
      await new Response((await bucket.get(foreign.key))?.body).text(),
    ).toBe(foreign.contents);
    const list = await owner.request.get(base);
    expect(list.status()).toBe(200);
    expect((await list.json()).data).toEqual([]);
    expect((await owner.request.delete(`${base}/${upload.id}`)).status()).toBe(
      404,
    );
  });
});

test("deleting an unknown upload returns 404", async ({ run, createActor }) => {
  await run(async () => {
    const owner = await createActor();
    expect(
      (await owner.request.delete(`${base}/${crypto.randomUUID()}`)).status(),
    ).toBe(404);
  });
});
