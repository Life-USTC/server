import { expect } from "@playwright/test";
import { createDeferred } from "../../../../shared/deferred";
import { withBrowserWorkflow } from "../../../utils/browser-workflow";
import { test as calendarTest } from "../../../utils/calendar-presentation-fixture";
import { withHomeworkEffects } from "../../../utils/homework-effects";

// Keep the native page alive through the complete interruption regression,
// including setup and assertions if the runner ends the test body early.
const test = calendarTest.extend<{
  bodyOwnershipRun: (work: () => Promise<void>) => Promise<void>;
}>({
  bodyOwnershipRun: async ({ page: _page, run }, use) => {
    const operations: Promise<void>[] = [];
    try {
      await use((work) => {
        const operation = run(work);
        operations.push(
          operation.then(
            () => undefined,
            () => undefined,
          ),
        );
        return operation;
      });
    } finally {
      await Promise.all(operations);
    }
  },
});

function errorsIn(error: unknown): unknown[] {
  return error instanceof AggregateError
    ? error.errors.flatMap(errorsIn)
    : [error];
}

for (const observeReads of [false, true]) {
  test(`homework final effects join the interrupted callback (observeReads=${observeReads})`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ bodyOwnershipRun, calendar, isolatedWorker, page }) => {
    await bodyOwnershipRun(async () => {
      const cookie = await calendar.createSignedSessionCookie(
        calendar.users[0].id,
      );
      const ready = createDeferred();
      const closed = createDeferred();
      const afterClose = createDeferred();
      const releaseBody = createDeferred();
      const onClose = () => closed.resolve();
      page.once("close", onClose);
      const bodyError = new Error(
        "Original callback failure after native close",
      );
      const originalGet = page.request.get;
      const finalObservationStates: boolean[] = [];
      let producerPath: string | undefined;
      let bodyFinished = false;
      let failure: unknown;
      let workflowOutcome: Promise<{ error: unknown }> | undefined;
      let commentId: string | undefined;
      const commentBody = "Callback finally writes after native page closure";

      // Delegate genuine Worker requests without waiting, changing their
      // responses, or releasing the callback. Record observation ordering only.
      page.request.get = async (url, options) => {
        if (url === producerPath && page.isClosed())
          finalObservationStates.push(bodyFinished);
        return originalGet.call(page.request, url, options);
      };
      try {
        workflowOutcome = withBrowserWorkflow(page, async (workflow) => {
          const operation = workflow.run(() =>
            withHomeworkEffects(
              {
                page,
                isolatedWorker,
                account: calendar.users[0],
                sectionId: calendar.section.id,
                calendarMessages: [],
                auditActions: { comment_create: 1 },
                observeReads,
                runBody: workflow.body,
              },
              async ({ headers }) => {
                await page.context().addCookies([cookie]);
                expect((await page.goto("/api/health"))?.status()).toBe(200);
                producerPath =
                  "/__test/community-effects?id=" +
                  headers["x-test-community-probe"];
                ready.resolve();
                // Ending use releases workflow.body's race while this actual
                // callback still waits for the helper's genuine native close.
                await closed.promise;
                expect(page.isClosed()).toBe(true);
                afterClose.resolve();
                // The controller holds the real callback across an independent
                // Worker round trip. No request or response is substituted.
                await releaseBody.promise;
                const response = await page.request.post(
                  "/api/community/comments",
                  {
                    headers,
                    data: {
                      targetType: "section",
                      sectionJwId: calendar.section.jwId,
                      body: commentBody,
                    },
                  },
                );
                expect(response.status(), await response.text()).toBe(201);
                const created = (await response.json()) as { id: string };
                expect(created.id).toEqual(expect.any(String));
                commentId = created.id;
                bodyFinished = true;
                throw bodyError;
              },
            ),
          );
          const outcome = operation.then(
            () => ({ error: undefined }),
            (error: unknown) => ({ error }),
          );
          await Promise.race([
            ready.promise,
            outcome.then(({ error }) => {
              throw (
                error ?? new Error("Workflow ended before the callback barrier")
              );
            }),
          ]);
          // Deliberately return without awaiting operation, matching native
          // fixture interruption. withBrowserWorkflow owns its final join.
        }).then(
          () => ({ error: undefined }),
          (error: unknown) => ({ error }),
        );
        await Promise.race([
          afterClose.promise,
          workflowOutcome.then(({ error }) => {
            throw (
              error ?? new Error("Workflow ended before native page closure")
            );
          }),
        ]);
        const health = await originalGet.call(page.request, "/api/health");
        expect(health.status()).toBe(200);
        expect(await health.text()).toBe("ok\n");
        expect(bodyFinished).toBe(false);
        expect(finalObservationStates).toEqual([]);
      } finally {
        releaseBody.resolve();
        const result = await workflowOutcome;
        failure = result?.error;
        page.request.get = originalGet;
        page.removeListener("close", onClose);
      }

      const failures = errorsIn(failure);
      expect(failures).toHaveLength(2);
      expect(failures).toContain(bodyError);
      expect(failures.filter((error) => error !== bodyError)).toEqual([
        expect.objectContaining({
          message: "Browser workflow interrupted after fixture use ended",
        }),
      ]);
      expect(bodyFinished).toBe(true);
      expect(page.isClosed()).toBe(true);
      expect(finalObservationStates.length).toBeGreaterThan(0);
      expect(finalObservationStates.every(Boolean)).toBe(true);
      expect(commentId).toEqual(expect.any(String));
      expect(
        await isolatedWorker.database.owner.comment.findMany({
          where: { userId: calendar.users[0].id },
          select: { id: true, body: true, sectionId: true },
        }),
      ).toEqual([
        { id: commentId, body: commentBody, sectionId: calendar.section.id },
      ]);
      expect(
        await isolatedWorker.database.owner.auditLog.findMany({
          where: { userId: calendar.users[0].id },
        }),
      ).toEqual([
        expect.objectContaining({
          action: "comment_create",
          outcome: "success",
          userId: calendar.users[0].id,
          targetId: commentId,
        }),
      ]);
    });
  });
}

// A failed journey must drain the mutation it submitted, without waiting for a
// later step it never reached. Both successful and failed bodies still reject
// effects that were not declared by the scenario.
for (const outcome of [
  "failed-partial",
  "failed-unplanned",
  "successful-unplanned",
] as const) {
  test(`homework calendar finalization: ${outcome}`, {
    tag: "@Infrastructure/Runtime",
  }, async ({ bodyOwnershipRun, calendar, isolatedWorker, page }) => {
    await bodyOwnershipRun(async () => {
      const account = calendar.users[0];
      const message = { type: "user" as const, userId: account.id };
      const declaredMessages =
        outcome === "failed-partial" ? [message, message] : [];
      const bodyError = new Error(
        "Journey stopped after its first subscription mutation",
      );
      const cookie = await calendar.createSignedSessionCookie(account.id);
      let failure: unknown;
      try {
        await withHomeworkEffects(
          {
            page,
            isolatedWorker,
            account,
            calendarMessages: declaredMessages,
            observeReads: true,
          },
          async ({ headers }) => {
            await page.context().addCookies([cookie]);
            expect((await page.goto("/api/health"))?.status()).toBe(200);
            const response = await page.request.delete(
              "/api/workspace/subscriptions",
              {
                headers,
                data: { sectionIds: [calendar.section.id] },
              },
            );
            expect(response.status()).toBe(200);
            expect((await response.json()).subscription.sections).toEqual([]);
            if (outcome !== "successful-unplanned") throw bodyError;
          },
        );
      } catch (error) {
        failure = error;
      }
      const failures = errorsIn(failure);
      expect(failure).toBeInstanceOf(AggregateError);
      if (outcome === "failed-partial") expect(failures).toEqual([bodyError]);
      else {
        const bodyFailed = outcome === "failed-unplanned";
        expect(failures).toHaveLength(bodyFailed ? 2 : 1);
        if (bodyFailed) expect(failures).toContain(bodyError);
        else expect(failures).not.toContain(bodyError);
        expect(failures.filter((error) => error !== bodyError)).toEqual([
          expect.objectContaining({
            message: expect.stringContaining(
              bodyFailed ? "unplanned calendar message" : "toEqual",
            ),
          }),
        ]);
      }
      expect(page.isClosed()).toBe(true);
      expect(
        await isolatedWorker.database.owner.userSectionSubscription.count({
          where: { userId: account.id },
        }),
      ).toBe(0);
      // Verify consumer completion even when undeclared effects fail validation.
      const response = await page.request.get(
        `/__test/calendar-consumer?userId=${account.id}`,
        {
          headers: { "x-test-storage-secret": "local-test-storage-observer" },
        },
      );
      expect(response.status()).toBe(200);
      const consumer = await response.json();
      expect(consumer.attempts).toHaveLength(1);
      expect(consumer.attempts[0]).toMatchObject({
        userId: account.id,
        attempts: 1,
        ackCalls: 1,
        retryCalls: 0,
        complete: true,
        errors: [],
        calendar: expect.any(String),
      });
      expect(consumer.calendar).toBe(consumer.attempts[0].calendar);
      expect(JSON.parse(consumer.calendar)).toMatchObject({
        version: 2,
        text: expect.stringContaining("BEGIN:VCALENDAR"),
      });
    });
  });
}
