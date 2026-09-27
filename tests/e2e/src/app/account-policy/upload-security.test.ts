import { expect, test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

async function createActors() {
  const marker = `upload-security-${crypto.randomUUID()}`;
  return withE2ePrisma(async (db) => {
    const users = [];
    for (const role of ["owner", "other"]) {
      users.push(
        await db.user.create({
          data: {
            name: `Upload ${role}`,
            username: `us${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${marker}-${role}@example.test`,
          },
        }),
      );
    }
    const [owner, other] = users;
    if (!owner || !other) throw new Error("Missing upload actors");
    return { owner, other, marker };
  });
}

async function cleanupActors(actors: Awaited<ReturnType<typeof createActors>>) {
  const ids = [actors.owner.id, actors.other.id];
  await withE2ePrisma(async (db) => {
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { subjectUserId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  });
}

test("upload.permission-and-quota", async ({ page, browser, request }) => {
  const actors = await createActors();
  const otherContext = await browser.newContext({
    baseURL: PLAYWRIGHT_BASE_URL,
  });
  let completedId: string | undefined;
  try {
    await page
      .context()
      .addCookies([await createSignedSessionCookie(actors.owner.id)]);
    await otherContext.addCookies([
      await createSignedSessionCookie(actors.other.id),
    ]);
    const input = {
      filename: "quota-boundary.txt",
      contentType: "text/plain",
      size: 2,
    };
    const anonymous = await request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(anonymous.status()).toBe(401);
    const initial = await page.request.get("/api/workspace/uploads");
    expect(initial.status()).toBe(200);
    const {
      meta: { quotaBytes, maxFileSizeBytes },
    } = (await initial.json()) as {
      meta: { quotaBytes: number; maxFileSizeBytes: number };
    };
    expect(quotaBytes).toBeGreaterThan(12);
    await withE2ePrisma(async (db) => {
      // Existing completed usage is ledger data. Keep each historical file within
      // the public file limit; the new boundary upload below transfers real bytes.
      let remaining = quotaBytes - 12;
      let index = 0;
      while (remaining > 0) {
        const size = Math.min(remaining, maxFileSizeBytes);
        await db.upload.create({
          data: {
            userId: actors.owner.id,
            key: `uploads/${actors.owner.id}/${actors.marker}-${index++}`,
            filename: "existing-owned-file.txt",
            contentType: "text/plain",
            size,
          },
        });
        remaining -= size;
      }
      for (const expired of [false, true]) {
        await db.uploadPending.create({
          data: {
            userId: actors.owner.id,
            key: `uploads/${actors.owner.id}/${actors.marker}-${expired ? "expired" : "live"}`,
            filename: "pending-file.txt",
            contentType: "text/plain",
            size: expired ? maxFileSizeBytes : 10,
            expiresAt: new Date(Date.now() + (expired ? -60_000 : 300_000)),
            attemptId: crypto.randomUUID(),
          },
        });
      }
    });
    const usage = await page.request.get("/api/workspace/uploads");
    expect((await usage.json()).meta.usedBytes).toBe(quotaBytes - 2);
    const liveKeys = () =>
      withE2ePrisma((db) =>
        db.uploadPending.findMany({
          where: { userId: actors.owner.id, expiresAt: { gt: new Date() } },
          select: { key: true, size: true },
          orderBy: { key: "asc" },
        }),
      );
    const before = await liveKeys();
    const exceeded = await page.request.post("/api/workspace/uploads", {
      data: { ...input, size: 3 },
    });
    expect(exceeded.status()).toBe(400);
    expect(await exceeded.json()).toMatchObject({ error: "Quota exceeded" });
    expect(await liveKeys()).toEqual(before);

    const accepted = await page.request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(accepted.status()).toBe(200);
    const reservation = (await accepted.json()) as { key: string; url: string };
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);
    const full = await page.request.post("/api/workspace/uploads", {
      data: { ...input, size: 1 },
    });
    expect(full.status()).toBe(400);
    expect(await full.json()).toMatchObject({ error: "Quota exceeded" });
    expect(
      (await liveKeys()).reduce((sum, pending) => sum + pending.size, 0),
    ).toBe(12);

    const put = await page.request.put(reservation.url, {
      data: Buffer.from("ok"),
      headers: { "content-type": "text/plain" },
    });
    expect(put.status(), await put.text()).toBe(200);
    const complete = await page.request.post(
      "/api/workspace/uploads/complete",
      {
        data: {
          key: reservation.key,
          filename: input.filename,
          contentType: input.contentType,
        },
      },
    );
    expect(complete.status(), await complete.text()).toBe(200);
    const body = await complete.json();
    completedId = body.upload.id;
    expect(body).toMatchObject({
      usedBytes: quotaBytes,
      quotaBytes,
      upload: { size: 2 },
    });
    const download = await page.request.get(
      `/api/workspace/uploads/${completedId}/download`,
    );
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe("ok");
    const other = await otherContext.request.post("/api/workspace/uploads", {
      data: input,
    });
    expect(other.status()).toBe(200);
    expect((await other.json()).usedBytes).toBe(0);
  } finally {
    if (completedId)
      await page.request.delete(`/api/workspace/uploads/${completedId}`);
    await otherContext.close();
    await cleanupActors(actors);
  }
});
