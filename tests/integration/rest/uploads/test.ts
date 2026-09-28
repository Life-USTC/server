import { expect } from "@playwright/test";
import { base, test } from "./_fixture";

for (const method of ["get", "post"] as const) {
  test(`anonymous upload ${method} returns JSON 401`, async ({ request }) => {
    const response = await request[method](
      base,
      method === "post"
        ? {
            data: {
              filename: "denied.txt",
              contentType: "text/plain",
              size: 5,
            },
          }
        : {},
    );
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
}

test("known uploads expose quota and stable owner-only pagination", async ({
  uploadState,
}) => {
  const { owner, other, knownUpload } = uploadState;
  const rows = [];
  for (let index = 0; index < 3; index++) {
    rows.push(
      await knownUpload({
        filename: `known-${index}.txt`,
        contents: "x".repeat(index + 1),
        createdAt: new Date(`2026-01-0${index + 1}`),
      }),
    );
  }
  await knownUpload({ userId: other.id, contents: "foreign bytes" });
  const response = await owner.request.get(base);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.pagination).toMatchObject({ page: 1, pageSize: 20, total: 3 });
  expect(body.meta).toEqual({
    maxFileSizeBytes: 50 * 1024 * 1024,
    quotaBytes: 100 * 1024 * 1024,
    usedBytes: 6,
  });
  expect(body.data.map((upload: { id: string }) => upload.id)).toEqual(
    rows.toReversed().map(({ id }) => id),
  );
  for (const [page, row] of [
    [1, rows[2]],
    [2, rows[1]],
  ] as const) {
    const read = await owner.request.get(`${base}?page=${page}&pageSize=1`);
    expect(read.status()).toBe(200);
    expect(await read.json()).toMatchObject({
      data: [
        expect.objectContaining({
          id: row.id,
          filename: row.filename,
          size: row.size,
        }),
      ],
      pagination: { page, pageSize: 1, total: 3 },
    });
  }
});

test("listing counts active reservations and ignores expired ones without mutating either", async ({
  uploadState,
}) => {
  const { db, owner, knownUpload, pending } = uploadState;
  await knownUpload({ contents: "hello" });
  await pending({ size: 7 });
  await pending({ size: 12_345, expiresAt: new Date(Date.now() - 60_000) });
  const before = await db.uploadPending.findMany({
    where: { userId: owner.id },
    orderBy: { id: "asc" },
  });
  const response = await owner.request.get(base);
  expect(response.status()).toBe(200);
  expect((await response.json()).meta.usedBytes).toBe(12);
  expect(
    await db.uploadPending.findMany({
      where: { userId: owner.id },
      orderBy: { id: "asc" },
    }),
  ).toEqual(before);
});

test("initialization reserves only the owner's quota and returns an on-site object URL", async ({
  uploadState,
}) => {
  const { db, owner, other, knownUpload, bucket } = uploadState;
  await knownUpload({ contents: "hi" });
  await knownUpload({ userId: other.id, contents: "unrelated quota" });
  const started = Date.now();
  const response = await owner.request.post(base, {
    data: { filename: "new.txt", contentType: "text/plain", size: 5 },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    maxFileSizeBytes: 50 * 1024 * 1024,
    quotaBytes: 100 * 1024 * 1024,
    usedBytes: 2,
  });
  expect(new URL(body.url).pathname).toBe(`${base}/object`);
  expect(new URL(body.url).origin).toBe(new URL(response.url()).origin);
  expect(new URL(body.url).searchParams.get("key")).toBe(body.key);
  const reservation = await db.uploadPending.findUniqueOrThrow({
    where: { key: body.key },
  });
  expect(reservation).toMatchObject({
    userId: owner.id,
    filename: "new.txt",
    size: 5,
    contentType: "text/plain",
    phase: "reserved",
  });
  expect(reservation.expiresAt.getTime()).toBeGreaterThanOrEqual(
    started + 290_000,
  );
  expect(reservation.expiresAt.getTime()).toBeLessThanOrEqual(
    Date.now() + 300_000,
  );
  expect(await bucket.head(body.key)).toBeNull();
  expect(await db.uploadPending.count({ where: { userId: other.id } })).toBe(0);
});

test("oversized initialization returns 413 without reserving quota", async ({
  uploadState,
}) => {
  const { db, owner, pending } = uploadState;
  await pending();
  const before = await db.uploadPending.findMany({
    where: { userId: owner.id },
  });
  const response = await owner.request.post(base, {
    data: {
      filename: "too-large.txt",
      contentType: "text/plain",
      size: 50 * 1024 * 1024 + 1,
    },
  });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "File too large" });
  expect(
    await db.uploadPending.findMany({ where: { userId: owner.id } }),
  ).toEqual(before);
});

test("complete upload journey connects reservation, R2 bytes, final metadata and download", async ({
  uploadState,
}) => {
  const { db, owner, bucket } = uploadState;
  const contents = "hello upload API";
  const response = await owner.request.post(base, {
    data: {
      filename: "journey.txt",
      contentType: "text/plain",
      size: Buffer.byteLength(contents),
    },
  });
  expect(response.status()).toBe(200);
  const { key, url } = await response.json();
  const put = await owner.request.put(url, {
    data: Buffer.from(contents),
    headers: { "content-type": "text/plain" },
  });
  expect(put.status()).toBe(200);
  expect(await put.json()).toEqual({ success: true });
  expect(await new Response((await bucket.get(key))?.body).text()).toBe(
    contents,
  );
  const complete = await owner.request.post(`${base}/complete`, {
    data: { key, filename: "journey.txt", contentType: "text/plain" },
  });
  expect(complete.status()).toBe(200);
  const body = await complete.json();
  expect(body.upload).toMatchObject({
    id: expect.any(String),
    key,
    filename: "journey.txt",
    size: Buffer.byteLength(contents),
  });
  expect(body.usedBytes).toBe(Buffer.byteLength(contents));
  expect(body.quotaBytes).toBe(100 * 1024 * 1024);
  expect(await db.upload.findUniqueOrThrow({ where: { key } })).toMatchObject({
    id: body.upload.id,
    userId: owner.id,
    size: Buffer.byteLength(contents),
    filename: "journey.txt",
  });
  expect(await db.uploadPending.findUnique({ where: { key } })).toBeNull();
  const download = await owner.request.get(
    `${base}/${body.upload.id}/download`,
  );
  expect(download.status()).toBe(200);
  expect(await download.text()).toBe(contents);
  const list = await owner.request.get(base);
  expect(list.status()).toBe(200);
  expect((await list.json()).data).toEqual([
    expect.objectContaining({ id: body.upload.id, filename: "journey.txt" }),
  ]);
});
