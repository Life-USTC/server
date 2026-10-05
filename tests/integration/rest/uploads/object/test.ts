import { expect } from "@playwright/test";
import { base, test } from "../_fixture";

const path = `${base}/object`;

test("anonymous object PUT returns JSON 401 without changing a reservation", {
  tag: "@Upload/REST",
}, async ({ run, request, uploadState }) => {
  await run(async () => {
    const { db, pending, bucket } = uploadState;
    const reservation = await pending();
    const before = await db.uploadPending.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    const response = await request.put(`${path}?key=${reservation.key}`, {
      data: Buffer.from("hello"),
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toEqual(expect.any(String));
    expect(
      await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      }),
    ).toEqual(before);
    expect(await bucket.head(reservation.key)).toBeNull();
  });
});

test("object PUT requires a key", { tag: "@Upload/REST" }, async ({
  run,
  createActor,
}) => {
  await run(async () => {
    const owner = await createActor();
    const response = await owner.request.put(path, {
      data: Buffer.from("hello"),
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  });
});

test("object PUT rejects another owner's key without changing its bytes or reservation", {
  tag: "@Upload/REST",
}, async ({ run, uploadState }) => {
  await run(async () => {
    const { db, owner, other, pending, bucket } = uploadState;
    const reservation = await pending({
      userId: other.id,
      phase: "uploaded",
      contents: "prior",
    });
    const before = await db.uploadPending.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    const response = await owner.request.put(`${path}?key=${reservation.key}`, {
      data: Buffer.from("hello"),
    });
    expect(response.status()).toBe(403);
    expect(
      await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      }),
    ).toEqual(before);
    expect(
      await new Response((await bucket.get(reservation.key))?.body).text(),
    ).toBe("prior");
  });
});

test("object PUT stores exact bytes and metadata and settles its reservation lease", {
  tag: "@Upload/REST",
}, async ({ run, uploadState }) => {
  await run(async () => {
    const { db, owner, pending, bucket } = uploadState;
    const reservation = await pending();
    const response = await owner.request.put(`${path}?key=${reservation.key}`, {
      data: Buffer.from("hello"),
      headers: { "content-type": "text/plain", "content-length": "5" },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(await bucket.head(reservation.key)).toMatchObject({
      size: 5,
      httpMetadata: { contentType: "text/plain" },
    });
    expect(
      await new Response((await bucket.get(reservation.key))?.body).text(),
    ).toBe("hello");
    expect(
      await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      }),
    ).toMatchObject({ phase: "uploaded", leaseExpiresAt: null });
    expect(await db.upload.count({ where: { userId: owner.id } })).toBe(0);
  });
});

for (const failure of ["expired", "exceeds reservation"] as const) {
  test(`object PUT ${failure} preserves previous bytes and reservation state`, {
    tag: "@Upload/REST",
  }, async ({ run, uploadState }) => {
    await run(async () => {
      const { db, owner, pending, bucket } = uploadState;
      const reservation = await pending({
        contents: "prior",
        phase: "uploaded",
        ...(failure === "expired"
          ? { expiresAt: new Date(Date.now() - 60_000) }
          : {}),
      });
      const before = await db.uploadPending.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      const response = await owner.request.put(
        `${path}?key=${reservation.key}`,
        {
          data: Buffer.from(failure === "expired" ? "hello" : "longer"),
        },
      );
      expect(response.status()).toBe(failure === "expired" ? 400 : 413);
      expect(await response.json()).toEqual({
        error:
          failure === "expired" ? "Upload session expired" : "File too large",
      });
      expect(
        await db.uploadPending.findUniqueOrThrow({
          where: { id: reservation.id },
        }),
      ).toEqual(before);
      expect(
        await new Response((await bucket.get(reservation.key))?.body).text(),
      ).toBe("prior");
    });
  });
}
