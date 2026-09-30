import { test as oauthTest } from "../src/app/api/mcp/_fixture";
import { withBrowserWorkflow } from "./browser-workflow";
import { createCalendarContractFixture } from "./calendar-contract";
import {
  type CalendarProtocol,
  type CalendarProtocolChecks,
  withCalendarProtocol,
} from "./calendar-protocol-lifecycle";
import { DEV_SEED } from "./dev-seed";

export type PrivateCalendar = Omit<
  Awaited<ReturnType<typeof createCalendarContractFixture>>,
  "cleanup"
>;
/** Mutable calendars belong to a private real Worker. Each factory invocation
 * creates explicit user/section/semester memberships in that same database. */
export const test = oauthTest.extend<{
  calendarProtocolRun: (
    work: (io: CalendarProtocol) => Promise<CalendarProtocolChecks>,
  ) => Promise<void>;
  calendarSemester: number;
  createCalendar: () => Promise<PrivateCalendar>;
  calendar: PrivateCalendar;
}>({
  calendarProtocolRun: async (
    { page, request, playwright, isolatedWorker, run },
    use,
    testInfo,
  ) => {
    await withBrowserWorkflow(page, async (workflow) => {
      await use((work) =>
        workflow.run(() =>
          run(() =>
            withCalendarProtocol(
              {
                page,
                observer: request,
                isolatedWorker,
                createRequest: (headers) =>
                  playwright.request.newContext({
                    baseURL: isolatedWorker.origin,
                    extraHTTPHeaders: headers,
                  }),
                runBody: workflow.body,
                testInfo,
              },
              work,
            ),
          ),
        ),
      );
    });
  },
  calendarSemester: async ({ isolatedWorker, run }, use) => {
    const semester = await run(() =>
      isolatedWorker.database.owner.semester.create({
        data: {
          jwId: DEV_SEED.semesterJwId,
          code: "421",
          nameCn: DEV_SEED.semesterNameCn,
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-12-31"),
        },
      }),
    );
    await use(semester.id);
  },
  createCalendar: async ({ isolatedWorker, calendarSemester, run }, use) => {
    // The domain fixture reads this exact prerequisite; never borrow a section
    // from another test to infer which semester the private calendar belongs to.
    if (!calendarSemester)
      throw new Error("Calendar semester was not arranged");
    await use(() =>
      run(async () => {
        const { cleanup: _cleanup, ...calendar } =
          await createCalendarContractFixture((work) =>
            work(isolatedWorker.database.owner),
          );
        return calendar;
      }),
    );
  },
  calendar: async ({ createCalendar }, use) => {
    await use(await createCalendar());
    // isolatedWorker stops requests/queues before disposing all owned data.
  },
});
