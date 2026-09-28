import { test as base } from "@playwright/test";
import { createCalendarContractFixture } from "./calendar-contract";

export type CalendarFixture = Awaited<
  ReturnType<typeof createCalendarContractFixture>
>;

export const test = base.extend<{ calendar: CalendarFixture }>({
  calendar: async ({ page }, use) => {
    const calendar = await createCalendarContractFixture();
    try {
      await use(calendar);
    } finally {
      try {
        await page.close();
      } finally {
        await calendar.cleanup();
      }
    }
  },
});
