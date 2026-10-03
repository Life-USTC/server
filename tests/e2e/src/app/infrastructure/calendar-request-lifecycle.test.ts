import { expect, type Request } from "@playwright/test";
import { observeCalendarFinalization } from "../../../utils/calendar-finalization-observer";
import { calendarLifecycleBarrier } from "../../../utils/calendar-lifecycle-barrier";
import { test } from "../../../utils/calendar-presentation-fixture";
import { withHomeworkEffects } from "../../../utils/homework-effects";
import { gotoAndWaitForReady } from "../../../utils/page-ready";

const calendarPath = "/api/workspace/calendar/events";
function calendarRange(request: Request, day: string) {
  const url = new URL(request.url());
  return (
    request.method() === "GET" &&
    url.pathname === calendarPath &&
    url.searchParams.get("dateFrom") === day &&
    url.searchParams.get("dateTo") === day &&
    url.searchParams.get("page") === "1" &&
    url.searchParams.get("pageSize") === "100"
  );
}

for (const failAfterRelease of [false, true]) {
  test(`calendar cancellation ${failAfterRelease ? "reports the real old-range handler failure" : "joins the real old-range handler before closing its page"}`, async ({
    calendar,
    isolatedWorker,
    page,
    run,
  }) => {
    await run(async () => {
      const barrier = await calendarLifecycleBarrier(isolatedWorker.database);
      const finalization = observeCalendarFinalization(page, barrier);
      const browserOperations: Promise<unknown>[] = [];
      const own = <T>(operation: Promise<T>) => {
        browserOperations.push(operation);
        void operation.catch(() => undefined);
        return operation;
      };
      let workflow: Promise<void> | undefined;
      let outcome: Promise<PromiseSettledResult<void>> | undefined;
      let settled = false;
      try {
        workflow = withHomeworkEffects(
          {
            page,
            isolatedWorker,
            account: calendar.users[0],
            sectionId: calendar.section.id,
            calendarTokenCreated: true,
            calendarMessages: [],
            observeReads: true,
          },
          async ({ headers }) => {
            await page
              .context()
              .addCookies([
                await calendar.createSignedSessionCookie(calendar.users[0].id),
                { name: "NEXT_LOCALE", value: "en-us", url: calendar.origin },
              ]);
            const start = new URL(calendar.academicUrl("day"), calendar.origin);
            start.searchParams.set("calendarDay", calendar.activityDate);
            const initialResponse = own(
              page.waitForResponse((response) =>
                calendarRange(response.request(), calendar.activityDate),
              ),
            );
            await gotoAndWaitForReady(page, start.href);
            const initial = await initialResponse;
            expect(initial.status()).toBe(200);
            await initial.body();
            const agenda = page
              .getByTestId("calendar-agenda")
              .filter({ visible: true });
            await expect(
              agenda.getByRole("link", {
                name: new RegExp(calendar.young.name),
              }),
            ).toBeVisible();

            // Day navigation changes local state and replaces the URL. It does
            // not issue a second SSR load that could take this one-shot gate.
            await barrier.blockRead(
              calendar.users[0].id,
              calendar.todo.id,
              failAfterRelease,
            );
            const oldRequest = own(
              page.waitForRequest((request) =>
                calendarRange(request, calendar.date),
              ),
            );
            await page
              .getByRole("button", { name: /^(Previous day|前一天)$/ })
              .click();
            const old = await oldRequest;
            await barrier.waitForBlocked(/SELECT[\s\S]*"Todo"/);

            const aborted = own(
              page.waitForEvent("requestfailed", {
                predicate: (request) => request === old,
              }),
            );
            const replacementResponse = own(
              page.waitForResponse((response) =>
                calendarRange(response.request(), calendar.activityDate),
              ),
            );
            await page
              .getByRole("button", { name: /^(Next day|后一天)$/ })
              .click();
            expect((await aborted).failure()?.errorText).toBe(
              "net::ERR_ABORTED",
            );
            expect(await old.response()).toBeNull();
            const replacement = await replacementResponse;
            expect(replacement.request()).not.toBe(old);
            expect(replacement.status()).toBe(200);
            await replacement.body();
            await expect(page).toHaveURL(
              new RegExp(`calendarDay=${calendar.activityDate}`),
            );
            await expect(
              agenda.getByRole("link", {
                name: new RegExp(calendar.young.name),
              }),
            ).toBeVisible();
            await barrier.assertStillBlocked();
            // Ordinary callback completion starts the real helper's finalization.
            finalization.arm(
              `/__test/community-effects?id=${headers["x-test-community-probe"]}`,
            );
          },
        );
        // Observe rejection immediately, while preserving the original promise
        // for both the race and the mandatory final join.
        outcome = workflow.then(
          () => {
            settled = true;
            return { status: "fulfilled" as const, value: undefined };
          },
          (reason: unknown) => {
            settled = true;
            return { status: "rejected" as const, reason };
          },
        );
        await Promise.race([
          finalization.entered,
          workflow.then(() => {
            throw new Error("Workflow finished before native drain entry");
          }),
        ]);
        await finalization.assertPending();
        expect(settled).toBe(false);
        await barrier.release();
        const result = await outcome;
        if (failAfterRelease) {
          expect(result.status).toBe("rejected");
          if (result.status === "rejected")
            expect(result.reason).toMatchObject({
              errors: expect.arrayContaining([
                expect.objectContaining({
                  message: expect.stringContaining("Canceled Worker read"),
                }),
              ]),
            });
        } else {
          await workflow;
        }
        const producer = await finalization.result();
        const reads = producer.requests.filter(
          (request) => request.value.path === calendarPath,
        );
        expect(reads).toHaveLength(3);
        expect(
          new Set(reads.map((request) => request.value.requestId)).size,
        ).toBe(3);
        for (const read of reads) {
          expect(read.value.requestId).toMatch(/^[0-9a-f-]{36}$/);
          expect(read.value.method).toBe("GET");
          expect(read.outcome).toBe("fulfilled");
        }
        expect(reads.map((read) => read.result).sort()).toEqual(
          failAfterRelease ? [200, 200, 500] : [200, 200, 200],
        );
        expect(producer.backgroundErrors).toEqual([]);
        await barrier.assertBackendDisconnected();
      } finally {
        try {
          await barrier.release();
        } finally {
          try {
            await outcome;
          } finally {
            await Promise.allSettled(browserOperations);
            finalization.restore();
            await barrier.close();
          }
        }
      }
    });
  });
}
