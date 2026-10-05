import { expect } from "@playwright/test";
import { test } from "../api/mcp/_fixture";

test("audit.action-account-delete", { tag: "@Account/Web" }, async ({
  page,
  isolatedWorker,
  calendarProtocolRun,
  run,
}) => {
  // The guard remains owned until the complete request/body/probe finalizer has
  // returned, including interruption. Cleanup itself is an admitted operation.
  await run(async () => {
    const db = isolatedWorker.database.owner;
    let dropGuard: (() => Promise<unknown>) | undefined;
    const errors: unknown[] = [];
    try {
      await calendarProtocolRun(async (io) => {
        const user = await db.user.create({
          data: {
            id: crypto.randomUUID(),
            name: "Private account deletion audit owner",
            username: `ad${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
            email: `${crypto.randomUUID()}@example.test`,
          },
        });
        const actor = await isolatedWorker.createSession(user.id);
        const cookie = actor.cookie;
        const { id: sessionId } = await db.session.findFirstOrThrow({
          where: { userId: user.id },
          select: { id: true },
        });
        await page.context().addCookies([cookie]);
        await io.observeCalendar(user, [], { calendar: "absent" });
        const table = `account_delete_guard_${crypto.randomUUID().replaceAll("-", "")}`;
        const bodyMarker = `private-form-${crypto.randomUUID()}`;
        const requestIds: string[] = [];
        const submit = async () => {
          const response = await page.request.post(
            "/account/settings/danger?/deleteAccount",
            {
              form: { confirm: "DELETE", privateNote: bodyMarker },
              headers: { origin: isolatedWorker.origin, accept: "text/html" },
              maxRedirects: 0,
            },
          );
          await response.body();
          const requestId = response.headers()["x-request-id"];
          expect(requestId).toBeTruthy();
          expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
          expect(requestIds).not.toContain(requestId);
          requestIds.push(requestId);
          return response;
        };
        const audits = () =>
          db.auditLog.findMany({
            where: { action: "account_delete", sessionId },
            orderBy: { createdAt: "asc" },
          });
        await db.session.updateMany({
          where: { userId: user.id },
          data: { createdAt: new Date("2000-01-01T00:00:00Z") },
        });
        expect((await submit()).status()).toBe(403);
        expect(await db.user.count({ where: { id: user.id } })).toBe(1);
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
        // Register before acquisition: CREATE/INSERT and freshness commit in
        // one private transaction; a late failure still leaves owned cleanup.
        dropGuard = () =>
          db.$executeRawUnsafe(`DROP TABLE IF EXISTS public."${table}"`);
        await db.$transaction(async (tx) => {
          await tx.session.updateMany({
            where: { userId: user.id },
            data: { createdAt: new Date() },
          });
          await tx.$executeRawUnsafe(
            `CREATE TABLE public."${table}" ("userId" text REFERENCES public."User"("id") ON DELETE RESTRICT)`,
          );
          await tx.$executeRawUnsafe(
            `INSERT INTO public."${table}" ("userId") VALUES ($1)`,
            user.id,
          );
        });
        expect((await submit()).status()).toBe(500);
        expect(await db.user.count({ where: { id: user.id } })).toBe(1);
        await expect.poll(async () => (await audits()).length).toBe(2);
        const failedRows = await audits();
        expect(failedRows.map((row) => row.outcome)).toEqual([
          "denied",
          "failure",
        ]);
        expect(failedRows[1]).toMatchObject({
          channel: "web",
          targetType: "user",
          targetId: user.id,
          subjectUserId: user.id,
          userId: user.id,
          metadata: { selfService: true },
        });
        expect(failedRows.every((row) => row.outcome !== "success")).toBe(true);
        // This intentional release follows the failed response's EOF and its
        // persisted failure audit; only then may the next request delete.
        await db.$executeRawUnsafe(`DROP TABLE public."${table}"`);
        const deleted = await submit();
        expect(deleted.status()).toBe(303);
        expect(deleted.headers().location).toBe("/");
        expect(await db.user.count({ where: { id: user.id } })).toBe(0);
        await expect.poll(async () => (await audits()).length).toBe(3);
        const rows = await audits();
        expect(rows.map((row) => row.requestId)).toEqual(requestIds);
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
        expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
        return {
          async verifyTransport({ effects, sdkRequests }) {
            expect(sdkRequests).toEqual([]);
            expect(
              effects.requests
                .filter(({ value }) => value.method !== "GET")
                .map(({ value, result }) => [value.method, value.path, result]),
            ).toEqual([
              ["POST", "/account/settings/danger", 403],
              ["POST", "/account/settings/danger", 500],
              ["POST", "/account/settings/danger", 303],
            ]);
          },
          async verifyState() {
            // The success contract deliberately has no surviving actor.
            expect(await db.user.findMany()).toEqual([]);
            expect(await db.session.findMany()).toEqual([]);
            const finalRows = await db.auditLog.findMany({
              orderBy: { createdAt: "asc" },
            });
            expect(finalRows).toEqual(rows);
            expect(
              finalRows.map(
                ({
                  action,
                  channel,
                  outcome,
                  userId,
                  subjectUserId,
                  targetId,
                  targetType,
                  oauthClientId,
                  oauthGrantId,
                  sessionId,
                  requestId,
                  metadata,
                }) => ({
                  action,
                  channel,
                  outcome,
                  userId,
                  subjectUserId,
                  targetId,
                  targetType,
                  oauthClientId,
                  oauthGrantId,
                  sessionId,
                  requestId,
                  metadata,
                }),
              ),
            ).toEqual(
              ["denied", "failure", "success"].map((outcome, index) => ({
                action: "account_delete",
                channel: "web",
                outcome,
                userId: null,
                subjectUserId: null,
                targetId: null,
                targetType: "user",
                oauthClientId: null,
                oauthGrantId: null,
                sessionId,
                requestId: requestIds[index],
                metadata:
                  index === 0
                    ? { reason: "session_not_fresh" }
                    : { selfService: true },
              })),
            );
            expect(
              await db.$queryRawUnsafe<{ present: boolean }[]>(
                `SELECT to_regclass($1) IS NOT NULL AS present`,
                `public.${table}`,
              ),
            ).toEqual([{ present: false }]);
            expect(await db.oAuthClient.count()).toBe(0);
            expect(await db.oAuthConsent.count()).toBe(0);
            expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
            expect(await db.upload.count()).toBe(0);
            expect(await db.uploadPending.count()).toBe(0);
          },
        };
      });
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        await dropGuard?.();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        "Account deletion and guard cleanup failed",
      );
  });
});
