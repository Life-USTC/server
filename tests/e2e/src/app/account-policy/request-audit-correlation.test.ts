import { expect } from "@playwright/test";
import { createUploadBucket } from "../../../utils/upload-bucket";
import { createUploadedFileViaApi } from "../../../utils/uploads";
import { test } from "../api/mcp/_fixture";

test("browser responses correlate with audit rows and replace spoofed request IDs", async ({
  page,
  isolatedWorker,
  request,
  calendarProtocolRun,
}) => {
  const uploads: { uploadId: string; key: string }[] = [];
  const browserWrites: {
    method: string;
    path: string;
    status: number;
    requestId: string;
  }[] = [];
  await calendarProtocolRun(
    async (io) => {
      const db = isolatedWorker.database.owner;
      const bucket = createUploadBucket(request, isolatedWorker.origin);
      const user = await db.user.create({
        data: {
          id: crypto.randomUUID(),
          name: "Request correlation owner",
          username: `rc${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
          email: `${crypto.randomUUID()}@example.test`,
        },
      });
      const actor = await isolatedWorker.createSession(user.id);
      const cookie = actor.cookie;
      await page.context().addCookies([cookie]);
      const publicSpoof = crypto.randomUUID();
      const internalSpoof = crypto.randomUUID();
      const bodyMarker = `private-correlation-${crypto.randomUUID()}`;
      await io.observeCalendar(user, [], { calendar: "absent" });
      await page.goto("/account/settings/security");
      await db.session.updateMany({
        where: { userId: user.id },
        data: { createdAt: new Date("2000-01-01T00:00:00Z") },
      });
      const session = await db.session.findFirstOrThrow({
        where: { userId: user.id },
      });
      const responseIds = new Set<string>();
      const variants: Record<string, string>[] = [
        {},
        { "x-request-id": publicSpoof },
        {
          "x-life-ustc-request-id": internalSpoof,
          "x-request-id": publicSpoof,
        },
      ];
      for (const headers of variants) {
        const upload = await createUploadedFileViaApi(page.request, {
          filename: "correlation.txt",
          contents: bodyMarker,
        });
        const uploadId = upload.uploadId;
        uploads.push(upload);
        const stored = await bucket.get(upload.key);
        expect(stored).not.toBeNull();
        if (!stored) throw new Error("Uploaded R2 object is missing");
        expect(Buffer.from(stored.body).toString()).toBe(bodyMarker);
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
              const body = await result.text();
              return {
                status: result.status,
                actionStatus:
                  kind === "settings" ? JSON.parse(body).status : null,
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
          if (!response.requestId)
            throw new Error("Missing response request ID");
          expect(responseIds.has(response.requestId)).toBe(false);
          responseIds.add(response.requestId);
          const action =
            kind === "settings"
              ? "account_calendar_token_rotate"
              : "upload_delete";
          const rows = () =>
            db.auditLog.findMany({
              where: { userId: user.id, action, requestId: response.requestId },
            });
          await expect.poll(async () => (await rows()).length).toBe(1);
          expect((await rows())[0]).toMatchObject({
            subjectUserId: user.id,
            outcome: kind === "settings" ? "denied" : "success",
          });
          if (kind === "rest") {
            expect(
              await db.upload.findUnique({ where: { id: uploadId } }),
            ).toBeNull();
            expect(await bucket.head(upload.key)).toBeNull();
          }
        }
      }
      const rows = await db.auditLog.findMany({ where: { userId: user.id } });
      const serialized = JSON.stringify(rows);
      for (const secret of [
        publicSpoof,
        internalSpoof,
        cookie.value,
        bodyMarker,
        user.email,
      ])
        expect(serialized).not.toContain(secret);
      return {
        async verifyTransport({ effects, sdkRequests }) {
          expect(sdkRequests).toEqual([]);
          expect(uploads).toHaveLength(3);
          expect(browserWrites).toEqual(
            uploads.flatMap(({ uploadId }, index) => [
              {
                method: "POST",
                path: "/account/settings/security",
                status: 200,
                requestId: [...responseIds][index * 2],
              },
              {
                method: "DELETE",
                path: `/api/workspace/uploads/${uploadId}`,
                status: 200,
                requestId: [...responseIds][index * 2 + 1],
              },
            ]),
          );
          const writes = effects.requests.filter(
            ({ value }) => value.method !== "GET",
          );
          expect(writes).toHaveLength(15);
          expect(
            writes.map(({ value, result }) => [
              value.method,
              value.path,
              result,
            ]),
          ).toEqual(
            uploads.flatMap(({ uploadId }) => [
              ["POST", "/api/workspace/uploads", 200],
              ["PUT", "/api/workspace/uploads/object", 200],
              ["POST", "/api/workspace/uploads/complete", 200],
              ["POST", "/account/settings/security", 200],
              ["DELETE", `/api/workspace/uploads/${uploadId}`, 200],
            ]),
          );
        },
        async verifyState() {
          expect(responseIds.size).toBe(6);
          const finalRows = await db.auditLog.findMany({
            orderBy: { createdAt: "asc" },
          });
          expect(finalRows).toHaveLength(6);
          expect(
            finalRows.map(
              ({
                action,
                outcome,
                channel,
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
                outcome,
                channel,
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
            uploads.flatMap(({ uploadId }, index) => [
              {
                action: "account_calendar_token_rotate",
                outcome: "denied",
                channel: "web",
                userId: user.id,
                subjectUserId: user.id,
                targetId: user.id,
                targetType: "calendar_feed",
                oauthClientId: null,
                oauthGrantId: null,
                sessionId: session.id,
                requestId: [...responseIds][index * 2],
                metadata: { reason: "session_not_fresh" },
              },
              {
                action: "upload_delete",
                outcome: "success",
                channel: "rest",
                userId: user.id,
                subjectUserId: user.id,
                targetId: uploadId,
                targetType: "upload",
                oauthClientId: null,
                oauthGrantId: null,
                sessionId: session.id,
                requestId: [...responseIds][index * 2 + 1],
                metadata: { size: Buffer.byteLength(bodyMarker) },
              },
            ]),
          );
          const serialized = JSON.stringify(finalRows);
          for (const secret of [
            publicSpoof,
            internalSpoof,
            cookie.value,
            bodyMarker,
            user.email,
          ])
            expect(serialized).not.toContain(secret);
          expect(await db.user.findMany()).toEqual([user]);
          expect(user.calendarFeedToken).toBeNull();
          expect(await db.session.findMany()).toEqual([session]);
          expect(await db.upload.findMany()).toEqual([]);
          expect(await db.uploadPending.findMany()).toEqual([]);
          expect(
            await bucket.list({ prefix: `uploads/${user.id}/` }),
          ).toMatchObject({ objects: [], truncated: false });
          expect(await db.oAuthClient.count()).toBe(0);
          expect(await db.oAuthConsent.count()).toBe(0);
          expect(await db.oAuthGrantUsageDaily.count()).toBe(0);
        },
      };
    },
    async (response, incoming) => {
      await response.body();
      const index = browserWrites.length;
      const upload = uploads[Math.floor(index / 2)];
      if (!upload) throw new Error("Browser write has no owned upload");
      const settings = index % 2 === 0;
      expect(incoming.method()).toBe(settings ? "POST" : "DELETE");
      expect(new URL(incoming.url()).pathname).toBe(
        settings
          ? "/account/settings/security"
          : `/api/workspace/uploads/${upload.uploadId}`,
      );
      expect(response.status()).toBe(200);
      if (settings) expect((await response.json()).status).toBe(403);
      const requestId = response.headers()["x-request-id"];
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      browserWrites.push({
        method: incoming.method(),
        path: new URL(incoming.url()).pathname,
        status: response.status(),
        requestId,
      });
    },
  );
});
