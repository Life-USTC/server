import { expect } from "@playwright/test";
import { base, test } from "../_fixture";

const path = `${base}/complete`;

for (const payload of ["empty", "valid"] as const) {
  test(`anonymous completion with ${payload} payload returns JSON 401 and preserves the object and reservation`, {
    tag: "@Upload/REST",
  }, async ({ run, request, uploadState }) => {
    await run(async () => {
      const { db, pending, bucket } = uploadState;
      const reservation = await pending({
        phase: "uploaded",
        contents: "hello",
      });
      const before = await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      const data =
        payload === "empty"
          ? {}
          : { key: reservation.key, filename: "denied.txt" };
      const response = await request.post(path, { data });
      expect(response.status()).toBe(401);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(
        await db.uploadPending.findUniqueOrThrow({
          where: { id: reservation.id },
        }),
      ).toEqual(before);
      expect(
        await new Response((await bucket.get(reservation.key))?.body).text(),
      ).toBe("hello");
    });
  });
}

test("completion rejects another owner's key without changing its state", {
  tag: "@Upload/REST",
}, async ({ run, uploadState }) => {
  await run(async () => {
    const { db, owner, other, pending, bucket } = uploadState;
    const reservation = await pending({
      userId: other.id,
      phase: "uploaded",
      contents: "hello",
    });
    const before = await db.uploadPending.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    const response = await owner.request.post(path, {
      data: { key: reservation.key, filename: "denied.txt" },
    });
    expect(response.status()).toBe(403);
    expect(
      await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      }),
    ).toEqual(before);
    expect(
      await db.upload.count({
        where: { userId: { in: [owner.id, other.id] } },
      }),
    ).toBe(0);
    expect(
      await new Response((await bucket.get(reservation.key))?.body).text(),
    ).toBe("hello");
  });
});

for (const state of ["missing", "expired"] as const) {
  test(`completion with ${state} reservation returns 400 and leaves R2 cleanup to its lifecycle`, {
    tag: "@Upload/REST",
  }, async ({ run, uploadState }) => {
    await run(async () => {
      const { db, owner, pending, bucket } = uploadState;
      const reservation = await pending({
        phase: "uploaded",
        contents: "hello",
        expiresAt: new Date(Date.now() - 60_000),
      });
      if (state === "missing")
        await db.uploadPending.delete({ where: { id: reservation.id } });
      const before = await db.uploadPending.findUnique({
        where: { id: reservation.id },
      });
      const response = await owner.request.post(path, {
        data: { key: reservation.key, filename: "expired.txt" },
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({
        error: "Upload session expired",
      });
      expect(
        await db.uploadPending.findUnique({ where: { id: reservation.id } }),
      ).toEqual(before);
      expect(await db.upload.count({ where: { userId: owner.id } })).toBe(0);
      expect(
        await new Response((await bucket.get(reservation.key))?.body).text(),
      ).toBe("hello");
    });
  });
}

test("completion converts known uploaded state once and preserves the other owner's quota", {
  tag: "@Upload/REST",
}, async ({ run, uploadState }) => {
  await run(async () => {
    const { db, owner, other, pending, knownUpload, bucket } = uploadState;
    const reservation = await pending({ phase: "uploaded", contents: "hello" });
    const foreign = await knownUpload({
      userId: other.id,
      contents: "foreign bytes",
    });
    const otherBefore = await db.upload.findUniqueOrThrow({
      where: { id: foreign.id },
    });
    let createdId: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await owner.request.post(path, {
        data: {
          key: reservation.key,
          filename: "finished.txt",
          contentType: "text/plain",
        },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        usedBytes: 5,
        quotaBytes: 100 * 1024 * 1024,
        upload: {
          key: reservation.key,
          filename: "finished.txt",
          size: 5,
          createdAt: expect.any(String),
        },
      });
      if (createdId) expect(body.upload.id).toBe(createdId);
      createdId = body.upload.id;
    }
    expect(await db.upload.findMany({ where: { userId: owner.id } })).toEqual([
      expect.objectContaining({
        id: createdId,
        key: reservation.key,
        filename: "finished.txt",
        size: 5,
      }),
    ]);
    expect(
      await db.uploadPending.findUnique({ where: { key: reservation.key } }),
    ).toBeNull();
    expect(
      await db.upload.findUniqueOrThrow({ where: { id: foreign.id } }),
    ).toEqual(otherBefore);
    expect(
      await new Response((await bucket.get(reservation.key))?.body).text(),
    ).toBe("hello");
  });
});
