import { expect, test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/workspace-task-filters";

test("audit.action-account-delete", async ({ page }) => {
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Private account deletion audit owner",
        username: `ad${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${crypto.randomUUID()}@example.test`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  const { id: sessionId } = await withE2ePrisma((db) =>
    db.session.findFirstOrThrow({
      where: { userId: user.id },
      select: { id: true },
    }),
  );
  await page.context().addCookies([cookie]);
  const table = `account_delete_guard_${crypto.randomUUID().replaceAll("-", "")}`;
  const bodyMarker = `private-form-${crypto.randomUUID()}`;
  const requestIds: string[] = [];
  let installed = false;
  const submit = async () => {
    const response = await page.request.post(
      "/account/settings/danger?/deleteAccount",
      {
        form: { confirm: "DELETE", privateNote: bodyMarker },
        headers: { origin: PLAYWRIGHT_BASE_URL, accept: "text/html" },
        maxRedirects: 0,
      },
    );
    const requestId = response.headers()["x-request-id"];
    expect(requestId).toBeTruthy();
    requestIds.push(requestId as string);
    return response;
  };
  const audits = () =>
    withE2ePrisma((db) =>
      db.auditLog.findMany({
        where: { action: "account_delete", sessionId },
        orderBy: { createdAt: "asc" },
      }),
    );
  try {
    await withE2ePrisma((db) =>
      db.session.updateMany({
        where: { userId: user.id },
        data: { createdAt: new Date("2000-01-01T00:00:00Z") },
      }),
    );
    expect((await submit()).status()).toBe(403);
    expect(
      await withE2ePrisma((db) => db.user.count({ where: { id: user.id } })),
    ).toBe(1);
    await expect.poll(async () => (await audits()).length).toBe(1);
    expect((await audits())[0]).toMatchObject({
      action: "account_delete",
      channel: "web",
      outcome: "denied",
      userId: user.id,
      subjectUserId: user.id,
      targetType: "user",
      metadata: { reason: "session_not_fresh" },
    });
    await withE2ePrisma(async (db) => {
      await db.session.updateMany({
        where: { userId: user.id },
        data: { createdAt: new Date() },
      });
      // This private fixture relation rejects only deletion of this test's user.
      // It forces PostgreSQL rollback without changing app roles or shared data.
      await db.$executeRawUnsafe(
        `CREATE TABLE public."${table}" ("userId" text REFERENCES public."User"("id") ON DELETE RESTRICT)`,
      );
    });
    installed = true;
    await withE2ePrisma((db) =>
      db.$executeRawUnsafe(
        `INSERT INTO public."${table}" ("userId") VALUES ($1)`,
        user.id,
      ),
    );
    expect((await submit()).status()).toBe(500);
    expect(
      await withE2ePrisma((db) => db.user.count({ where: { id: user.id } })),
    ).toBe(1);
    await expect.poll(async () => (await audits()).length).toBe(2);
    const failedRows = await audits();
    expect(failedRows.map((row) => row.outcome)).toEqual(["denied", "failure"]);
    expect(failedRows[1]).toMatchObject({
      channel: "web",
      targetType: "user",
      targetId: user.id,
      subjectUserId: user.id,
      userId: user.id,
      metadata: { selfService: true },
    });
    expect(failedRows.every((row) => row.outcome !== "success")).toBe(true);
    await withE2ePrisma((db) =>
      db.$executeRawUnsafe(`DROP TABLE public."${table}"`),
    );
    installed = false;
    const deleted = await submit();
    expect(deleted.status()).toBe(303);
    expect(deleted.headers().location).toBe("/");
    expect(
      await withE2ePrisma((db) => db.user.count({ where: { id: user.id } })),
    ).toBe(0);
    await expect.poll(async () => (await audits()).length).toBe(3);
    const rows = await audits();
    expect(rows.map((row) => row.outcome)).toEqual([
      "denied",
      "failure",
      "success",
    ]);
    expect(rows[2]).toMatchObject({
      userId: null,
      subjectUserId: null,
      targetId: null,
      targetType: "user",
      channel: "web",
      metadata: { selfService: true },
    });
    const serialized = JSON.stringify(rows);
    for (const secret of [
      user.id,
      user.email,
      user.name,
      cookie.value,
      bodyMarker,
    ])
      expect(serialized).not.toContain(secret);
    expect(
      await withE2ePrisma((db) =>
        db.session.count({ where: { userId: user.id } }),
      ),
    ).toBe(0);
  } finally {
    if (installed)
      await withE2ePrisma((db) =>
        db.$executeRawUnsafe(`DROP TABLE public."${table}"`),
      );
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { sessionId },
            { requestId: { in: requestIds } },
            { userId: user.id },
            { subjectUserId: user.id },
          ],
        },
      });
      await db.user.deleteMany({ where: { id: user.id } });
    });
  }
});
