import { expect, test } from "@playwright/test";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";
import { createUploadedFileViaApi } from "../../../utils/uploads";

test("browser responses correlate with audit rows and replace spoofed request IDs", async ({
  page,
}) => {
  const user = await withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: "Request correlation owner",
        username: `rc${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
        email: `${crypto.randomUUID()}@example.test`,
      },
    }),
  );
  const cookie = await createSignedSessionCookie(user.id);
  await page.context().addCookies([cookie]);
  const publicSpoof = crypto.randomUUID();
  const internalSpoof = crypto.randomUUID();
  const bodyMarker = `private-correlation-${crypto.randomUUID()}`;
  let uploadId: string | undefined;
  try {
    await page.goto("/account/settings/security");
    await withE2ePrisma((db) =>
      db.session.updateMany({
        where: { userId: user.id },
        data: { createdAt: new Date("2000-01-01T00:00:00Z") },
      }),
    );
    const responseIds = new Set<string>();
    const variants: Record<string, string>[] = [
      {},
      { "x-request-id": publicSpoof },
      { "x-life-ustc-request-id": internalSpoof, "x-request-id": publicSpoof },
    ];
    for (const headers of variants) {
      const upload = await createUploadedFileViaApi(page.request, {
        filename: "correlation.txt",
        contents: bodyMarker,
      });
      uploadId = upload.uploadId;
      for (const kind of ["settings", "rest"]) {
        const response = await page.evaluate(
          async ({ headers, kind, bodyMarker, uploadId }) => {
            const result = await fetch(
              kind === "settings"
                ? "/account/settings/security?/rotateCalendarToken"
                : `/api/workspace/uploads/${uploadId}`,
              {
                method: kind === "settings" ? "POST" : "DELETE",
                headers: {
                  ...headers,
                  "content-type":
                    kind === "settings"
                      ? "application/x-www-form-urlencoded"
                      : "application/json",
                  accept: "application/json",
                },
                body:
                  kind === "settings"
                    ? new URLSearchParams({
                        privateNote: bodyMarker,
                      }).toString()
                    : undefined,
              },
            );
            return {
              status: result.status,
              actionStatus:
                kind === "settings" ? (await result.json()).status : null,
              requestId: result.headers.get("x-request-id"),
            };
          },
          { headers, kind, bodyMarker, uploadId },
        );
        expect(response.status).toBe(200);
        if (kind === "settings") expect(response.actionStatus).toBe(403);
        expect(response.requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(response.requestId).not.toBe(publicSpoof);
        expect(response.requestId).not.toBe(internalSpoof);
        if (!response.requestId) throw new Error("Missing response request ID");
        expect(responseIds.has(response.requestId)).toBe(false);
        responseIds.add(response.requestId);
        const action =
          kind === "settings"
            ? "account_calendar_token_rotate"
            : "upload_delete";
        const rows = () =>
          withE2ePrisma((db) =>
            db.auditLog.findMany({
              where: { userId: user.id, action, requestId: response.requestId },
            }),
          );
        await expect.poll(async () => (await rows()).length).toBe(1);
        expect((await rows())[0]).toMatchObject({
          subjectUserId: user.id,
          outcome: kind === "settings" ? "denied" : "success",
        });
        if (kind === "rest") uploadId = undefined;
      }
    }
    const rows = await withE2ePrisma((db) =>
      db.auditLog.findMany({ where: { userId: user.id } }),
    );
    const serialized = JSON.stringify(rows);
    for (const secret of [
      publicSpoof,
      internalSpoof,
      cookie.value,
      bodyMarker,
      user.email,
    ])
      expect(serialized).not.toContain(secret);
  } finally {
    if (uploadId)
      expect(
        (
          await page.request.delete(`/api/workspace/uploads/${uploadId}`)
        ).status(),
      ).toBe(200);
    await withE2ePrisma(async (db) => {
      await db.auditLog.deleteMany({
        where: { OR: [{ userId: user.id }, { subjectUserId: user.id }] },
      });
      await db.user.delete({ where: { id: user.id } });
    });
  }
});
