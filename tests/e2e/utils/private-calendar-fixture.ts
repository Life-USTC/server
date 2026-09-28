import { test as oauthTest } from "../src/app/api/mcp/_fixture";
import { createCalendarContractFixture } from "./calendar-contract";
import { DEV_SEED } from "./dev-seed";

type Calendar = Awaited<ReturnType<typeof createCalendarContractFixture>>;
/** Mutable calendars belong to a private real Worker. Each factory invocation
 * creates explicit user/section/semester memberships in that same database. */
export const test = oauthTest.extend<{
  calendarSemester: number;
  createCalendar: () => Promise<Calendar>;
  calendar: Calendar;
}>({
  calendarSemester: async ({ isolatedWorker }, use) => {
    const semester = await isolatedWorker.database.owner.semester.create({
      data: {
        jwId: DEV_SEED.semesterJwId,
        code: "421",
        nameCn: DEV_SEED.semesterNameCn,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-12-31"),
      },
    });
    await use(semester.id);
  },
  createCalendar: async ({ isolatedWorker, calendarSemester }, use) => {
    // The domain fixture reads this exact prerequisite; never borrow a section
    // from another test to infer which semester the private calendar belongs to.
    if (!calendarSemester)
      throw new Error("Calendar semester was not arranged");
    await use(() =>
      createCalendarContractFixture((run) =>
        run(isolatedWorker.database.owner),
      ),
    );
  },
  calendar: async ({ createCalendar }, use) => {
    await use(await createCalendar());
    // isolatedWorker stops requests/queues before disposing all owned data.
  },
});
