import { expect } from "@playwright/test";
import {
  OAUTH_CODE_RESPONSE_TYPE,
  OAUTH_DEVICE_CODE_GRANT_TYPE,
  OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
} from "@/lib/oauth/constants";
import { observeCalendarFinalization } from "../../../utils/calendar-finalization-observer";
import { calendarLifecycleBarrier } from "../../../utils/calendar-lifecycle-barrier";
import { test } from "../../../utils/calendar-presentation-fixture";
import { authorizeDeviceBearer } from "../../../utils/oauth-device-bearer";

test("calendar body completion retains real deferred OAuth usage and runtime cleanup", async ({
  calendar,
  isolatedWorker,
  page,
  run,
}, testInfo) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const userId = calendar.users[0].id;
    const clientId = crypto.randomUUID();
    const scope = "workspace.calendar:read";
    await db.oAuthClient.create({
      data: {
        clientId,
        clientSecret: crypto.randomUUID(),
        name: "Private calendar lifecycle",
        redirectUris: [`${calendar.origin}/oauth-lifecycle/callback`],
        scopes: [scope],
        grantTypes: [OAUTH_DEVICE_CODE_GRANT_TYPE],
        responseTypes: [OAUTH_CODE_RESPONSE_TYPE],
        type: "public",
        tokenEndpointAuthMethod: OAUTH_PUBLIC_CLIENT_AUTH_METHOD,
        requirePKCE: true,
      },
    });
    await page
      .context()
      .addCookies([await calendar.createSignedSessionCookie(userId)]);
    const token = await authorizeDeviceBearer(
      page.request,
      calendar.origin,
      clientId,
      scope,
    );
    const consent = await db.oAuthConsent.findUniqueOrThrow({
      where: { clientId_userId: { clientId, userId } },
      select: {
        userId: true,
        clientId: true,
        grantId: true,
        scopes: true,
        resources: true,
      },
    });
    expect(consent).toEqual({
      userId,
      clientId,
      grantId: expect.any(String),
      scopes: [scope],
      resources: [`${calendar.origin}/api/auth`],
    });
    expect(await db.deviceCode.count({ where: { clientId } })).toBe(0);
    const audits = () =>
      db.auditLog.findMany({
        where: { userId },
        select: { action: true, channel: true, outcome: true },
      });
    // Device approval/exchange persists consent, but emits no AuditLog action.
    // Assert that contract explicitly; never delete setup audit records.
    expect(await audits()).toEqual([]);
    const usage = () =>
      db.oAuthGrantUsageDaily.findMany({
        where: { userId, clientId },
        select: {
          userId: true,
          clientId: true,
          grantId: true,
          grantKey: true,
          feature: true,
          channel: true,
          readCount: true,
          writeCount: true,
          errorCount: true,
        },
      });
    expect(await usage()).toEqual([]);

    const barrier = await calendarLifecycleBarrier(isolatedWorker.database);
    const finalization = observeCalendarFinalization(page, barrier);
    const requestId = crypto.randomUUID();
    const probeId = crypto.randomUUID();
    const probePath = `/__test/community-effects?id=${probeId}`;
    const secret = { "x-test-storage-secret": "local-test-storage-observer" };
    let workflow: Promise<void> | undefined;
    let settled = false;
    try {
      await barrier.blockUsage(userId, clientId, consent.grantId);
      expect(
        (await page.request.post(probePath, { headers: secret })).status(),
      ).toBe(201);
      workflow = (async () => {
        try {
          const query = new URLSearchParams({
            dateFrom: calendar.date,
            dateTo: calendar.date,
            page: "1",
            pageSize: "100",
          });
          const response = await page.request.get(
            `/api/workspace/calendar/events?${query}`,
            {
              headers: {
                ...secret,
                authorization: `Bearer ${token}`,
                "x-test-community-probe": probeId,
                "x-test-community-request": requestId,
              },
            },
          );
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(body.data).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                type: "todo_due",
                title: calendar.todo.title,
              }),
            ]),
          );
          // The actual response body is complete while the real waitUntil
          // INSERT remains blocked. The production batching timer is not proof.
          await barrier.waitForBlocked(/INSERT INTO "OAuthGrantUsageDaily"/);
          expect(await usage()).toEqual([]);
          finalization.arm(probePath);
          expect(
            (await page.request.get(probePath, { headers: secret })).status(),
          ).toBe(200);
          expect(
            (
              await page.request.delete(probePath, { headers: secret })
            ).status(),
          ).toBe(204);
        } finally {
          await page.close();
        }
      })();
      void workflow.then(
        () => {
          settled = true;
        },
        () => {
          settled = true;
        },
      );
      await Promise.race([
        finalization.entered,
        workflow.then(() => {
          throw new Error("Workflow finished before native drain entry");
        }),
      ]);
      const blocked = await finalization.assertPending();
      expect(settled).toBe(false);
      await testInfo.attach("calendar-usage-pending", {
        body: JSON.stringify({
          ...barrier.identity,
          blocked,
          requestId,
          userId,
          clientId,
          grantId: consent.grantId,
        }),
        contentType: "application/json",
      });
      await barrier.release();
      await workflow;
      const producer = await finalization.result();
      expect(producer.backgroundErrors).toEqual([]);
      expect(producer.requests).toEqual([
        {
          outcome: "fulfilled",
          value: {
            method: "GET",
            path: "/api/workspace/calendar/events",
            requestId,
          },
          result: 200,
        },
      ]);
      expect(await usage()).toEqual([
        {
          userId,
          clientId,
          grantId: consent.grantId,
          grantKey: `grant:${consent.grantId}`,
          feature: "workspace.calendar",
          channel: "rest",
          readCount: 1,
          writeCount: 0,
          errorCount: 0,
        },
      ]);
      expect(await audits()).toEqual([]);
      await barrier.assertBackendDisconnected();
      await testInfo.attach("calendar-usage-complete", {
        body: JSON.stringify({
          ...barrier.identity,
          blocked,
          producer,
          usage: await usage(),
        }),
        contentType: "application/json",
      });
    } finally {
      try {
        await barrier.release();
      } finally {
        try {
          await workflow;
        } finally {
          finalization.restore();
          await barrier.close();
        }
      }
    }
  });
});
