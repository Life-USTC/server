import { expect, type Locator, type Page } from "@playwright/test";
import {
  type CalendarFixture,
  test,
} from "../../../../utils/calendar-presentation-fixture";
import { gotoAndWaitForReady } from "../../../../utils/page-ready";

type Locale = "en-us" | "zh-cn";
type Meeting = {
  date: string;
  weekday: number;
  week: number;
  place: string;
};

// The semester really begins April 8. April 29 and May 1 share a Sunday week,
// while the explicitly dated May 12 makeup retains stored teaching week 4.
const meetings: Meeting[] = [
  { date: "2026-04-08", weekday: 3, week: 1, place: "First teaching room" },
  { date: "2026-04-29", weekday: 3, week: 8, place: "Calendar teaching room" },
  {
    date: "2026-05-01",
    weekday: 5,
    week: 8,
    place: "Cross-month teaching room",
  },
  { date: "2026-05-12", weekday: 2, week: 4, place: "Makeup teaching room" },
];

function academicUrl(fixture: CalendarFixture, date: string) {
  const url = new URL(fixture.academicUrl("week"), fixture.origin);
  url.searchParams.set("calendarDay", date);
  url.searchParams.set("calendarWeek", date);
  url.searchParams.set("calendarMonth", date.slice(0, 7));
  // Preserve the fixture's semester and fixed snapshotAt verbatim.
  return `${url.pathname}${url.search}`;
}

function labels(locale: Locale) {
  return locale === "en-us"
    ? { day: "Day", week: "Week", month: "Month", semester: "Semester" }
    : { day: "日", week: "周", month: "月", semester: "学期" };
}

function rowForDate(grid: Locator, page: Page, date: string) {
  return grid.getByRole("row").filter({
    has: page.getByRole("gridcell").filter({
      has: page.getByText(date.slice(5), { exact: true }),
    }),
  });
}

// These explicit fixture bounds are independent of the product range helpers.
function expectedDates(view: "week" | "month" | "semester", date: string) {
  const weekStarts: Record<string, string> = {
    "2026-04-08": "2026-04-05",
    "2026-04-29": "2026-04-26",
    "2026-05-01": "2026-04-26",
    "2026-05-12": "2026-05-10",
    "2026-05-19": "2026-05-17",
    "2026-05-20": "2026-05-17",
    "2026-06-02": "2026-05-31",
  };
  const months: Record<string, { start: string; count: number }> = {
    "2026-04": { start: "2026-03-29", count: 42 },
    "2026-05": { start: "2026-04-26", count: 42 },
    "2026-06": { start: "2026-05-31", count: 42 },
  };
  const range =
    view === "semester"
      ? { start: "2026-04-05", count: 161 }
      : view === "month"
        ? months[date.slice(0, 7)]
        : { start: weekStarts[date], count: 7 };
  if (!range?.start)
    throw new Error("Missing explicit calendar fixture bounds");
  return Array.from({ length: range.count }, (_, index) =>
    new Date(Date.parse(`${range.start}T00:00:00Z`) + index * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
}

async function expectDateRange(
  page: Page,
  view: "week" | "month" | "semester",
  date: string,
  width: number,
) {
  const expected = expectedDates(view, date);
  if (width === 1280) {
    const grid = page.getByTestId("workspace-calendar-grid");
    await expect(grid.getByRole("rowheader")).toHaveCount(expected.length / 7);
    const cells = grid.getByRole("gridcell");
    await expect(cells).toHaveCount(expected.length);
    await expect
      .poll(() =>
        cells.evaluateAll((elements) =>
          elements.map((cell) => cell.firstElementChild?.textContent?.trim()),
        ),
      )
      .toEqual(expected.map((key) => key.slice(5)));
  } else {
    // CalendarTab builds every agenda date, including dates without events.
    const days = page
      .getByTestId("calendar-agenda")
      .filter({ visible: true })
      .locator("section");
    await expect(days).toHaveCount(expected.length);
    await expect
      .poll(() =>
        days.evaluateAll((elements) =>
          elements.map((day) => day.getAttribute("aria-labelledby")),
        ),
      )
      .toEqual(expected.map((key) => `agenda-${key}`));
  }
}

async function selectPeriod(
  page: Page,
  locale: Locale,
  view: "week" | "month" | "semester",
  date: string,
) {
  if (view === "semester") return;
  const period = page
    .getByTestId("workspace-calendar-mobile-toolbar")
    .locator('p[aria-live="polite"]');
  // Switching view deliberately returns to the fixture's reference date.
  // Move the real period controls afterwards; do not change that product rule.
  const shape = view === "month" ? /^\d{4}-\d{2}$/ : /\d{4}-\d{2}-\d{2}/;
  await expect(period).toHaveText(shape);
  const value = (await period.innerText()).match(/\d{4}-\d{2}(?:-\d{2})?/);
  if (!value)
    throw new Error("Calendar period heading must identify its dates");
  const current = value[0];
  const target =
    view === "month" ? date.slice(0, 7) : expectedDates("week", date)[0];
  if (!target) throw new Error("Calendar fixture needs a target period");
  const monthNumber = (key: string) =>
    Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
  const delta =
    view === "month"
      ? monthNumber(target) - monthNumber(current)
      : (Date.parse(`${target}T00:00:00Z`) -
          Date.parse(`${current}T00:00:00Z`)) /
        604_800_000;
  expect(Number.isInteger(delta)).toBe(true);
  const previous =
    locale === "en-us"
      ? view === "month"
        ? "Previous month"
        : "Previous week"
      : view === "month"
        ? "上个月"
        : "上一周";
  const next =
    locale === "en-us"
      ? view === "month"
        ? "Next month"
        : "Next week"
      : view === "month"
        ? "下个月"
        : "下一周";
  for (let index = 0; index < Math.abs(delta); index++) {
    const before = await period.innerText();
    await page
      .getByRole("button", { name: delta > 0 ? next : previous, exact: true })
      .click();
    await expect(period).not.toHaveText(before);
  }
  if (view === "month") await expect(period).toHaveText(target);
  else await expect(period).toContainText(target);
}

async function expectUnclipped(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  const geometry = await locator.evaluate((element) => {
    type Clip = {
      left: number;
      top: number;
      right: number;
      bottom: number;
      details: Record<string, unknown>;
    };
    const observations: Array<Record<string, unknown>> = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text = walker.nextNode();
    let lineCount = 0;
    const clipped: Array<{
      left: number;
      top: number;
      right: number;
      bottom: number;
    }> = [];
    while (text) {
      if (text.textContent?.trim()) {
        const clips: Clip[] = [
          {
            left: 0,
            top: 0,
            right: innerWidth,
            bottom: innerHeight,
            details: { tag: "viewport" },
          },
        ];
        const ancestors: Array<Record<string, unknown>> = [];
        for (
          let ancestor: Element | null = text.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          const box = ancestor.getBoundingClientRect();
          const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
          const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
          const details = {
            tag: ancestor.tagName,
            id: ancestor.id,
            className: ancestor.getAttribute("class"),
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            bcr: {
              left: box.left,
              top: box.top,
              right: box.right,
              bottom: box.bottom,
            },
            client: {
              left: ancestor.clientLeft,
              top: ancestor.clientTop,
              width: ancestor.clientWidth,
              height: ancestor.clientHeight,
            },
            border: {
              left: style.borderLeftWidth,
              top: style.borderTopWidth,
              right: style.borderRightWidth,
              bottom: style.borderBottomWidth,
            },
          };
          ancestors.push(details);
          // Root overflow is propagated to the viewport already checked above;
          // its document BCR scrolls and is not a second viewport clip.
          if ((clipX || clipY) && ancestor !== document.documentElement) {
            // Preserve fractional padding-box bounds. clientWidth/clientHeight
            // round to integers and cannot define the text clipping rectangle.
            const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
            const borderRight = Number.parseFloat(style.borderRightWidth) || 0;
            const borderTop = Number.parseFloat(style.borderTopWidth) || 0;
            const borderBottom =
              Number.parseFloat(style.borderBottomWidth) || 0;
            const scrollbarWidth =
              ancestor instanceof HTMLElement &&
              /^(auto|scroll)$/.test(style.overflowY)
                ? Math.max(
                    0,
                    ancestor.offsetWidth -
                      ancestor.clientWidth -
                      borderLeft -
                      borderRight,
                  )
                : 0;
            const scrollbarHeight =
              ancestor instanceof HTMLElement &&
              /^(auto|scroll)$/.test(style.overflowX)
                ? Math.max(
                    0,
                    ancestor.offsetHeight -
                      ancestor.clientHeight -
                      borderTop -
                      borderBottom,
                  )
                : 0;
            clips.push({
              left: clipX ? box.left + borderLeft : -Infinity,
              right: clipX
                ? box.right - borderRight - scrollbarWidth
                : Infinity,
              top: clipY ? box.top + borderTop : -Infinity,
              bottom: clipY
                ? box.bottom - borderBottom - scrollbarHeight
                : Infinity,
              details,
            });
          }
        }
        const range = document.createRange();
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          lineCount++;
          observations.push({
            text: text.textContent,
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            },
            ancestors,
            clipping: clips,
          });
          // Text lines must fit the viewport and every clipping padding box.
          if (
            clips.some(
              (clip) =>
                rect.left < clip.left ||
                rect.right > clip.right ||
                rect.top < clip.top ||
                rect.bottom > clip.bottom,
            )
          )
            clipped.push({
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            });
        }
      }
      text = walker.nextNode();
    }
    return {
      width: element.clientWidth,
      height: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight,
      lineCount,
      clipped,
      observations,
    };
  });
  expect(geometry.width).toBeGreaterThan(0);
  expect(geometry.height).toBeGreaterThan(0);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.height);
  expect(geometry.lineCount).toBeGreaterThan(0);
  expect(geometry.clipped, JSON.stringify(geometry.observations)).toEqual([]);
}

for (const locale of ["en-us", "zh-cn"] as const) {
  for (const width of [1280, 390]) {
    test(`calendar.teaching-week-cross-route ${locale} ${width}`, {
      tag: "@Calendar/Web",
    }, async ({ page, calendar: fixture, calendarDb, calendarRun }) => {
      // Arrange before the unchanged workflow/effects snapshot. The original
      // fixture's April 29/week 8 meeting is deliberately not recreated.
      await calendarDb((db) =>
        db.schedule.createMany({
          data: meetings
            .filter((meeting) => meeting.date !== fixture.date)
            .map((meeting) => ({
              sectionId: fixture.section.id,
              scheduleGroupId: fixture.group.id,
              date: new Date(`${meeting.date}T00:00:00Z`),
              weekday: meeting.weekday,
              weekIndex: meeting.week,
              startTime: 900,
              endTime: 1000,
              startUnit: 1,
              endUnit: 2,
              periods: 2,
              customPlace: meeting.place,
            })),
        }),
      );
      await calendarRun(
        async () => {
          await page.setViewportSize({ width, height: 900 });
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              { name: "NEXT_LOCALE", value: locale, url: fixture.origin },
            ]);
          await gotoAndWaitForReady(
            page,
            `/catalog/sections/${fixture.section.jwId}/calendar`,
          );
          const table = page.getByTestId("section-calendar-table");
          for (const meeting of meetings) {
            const row = table
              .getByRole("row")
              .filter({
                has: page.getByRole("cell", {
                  name: meeting.date,
                  exact: true,
                }),
              })
              .filter({ hasText: meeting.place });
            await expect(row).toHaveCount(1);
            const cells = row.getByRole("cell");
            await expect(cells.nth(1)).toHaveText(meeting.date);
            await expect(cells.nth(2)).toHaveText(String(meeting.week));
            await expect(cells.nth(3)).toContainText("09:00");
            await expect(cells.nth(3)).toContainText("10:00");
            await expect(cells.nth(4)).toHaveText(meeting.place);
            // The phone table intentionally scrolls locally; bring each real
            // field into view rather than treating page-level overflow as proof.
            for (const index of [1, 2, 3, 4]) {
              await cells.nth(index).scrollIntoViewIfNeeded();
              await expectUnclipped(cells.nth(index));
            }
          }

          await page
            .context()
            .addCookies([
              await fixture.createSignedSessionCookie(fixture.users[0].id),
            ]);
          const title =
            locale === "en-us" ? fixture.course.nameEn : fixture.course.nameCn;
          if (!title)
            throw new Error("Calendar fixture needs both course titles");
          const names = labels(locale);
          for (const [index, meeting] of meetings.entries()) {
            // Keep the cross-date journey in one document using the real period controls.
            if (index === 0)
              await gotoAndWaitForReady(
                page,
                academicUrl(fixture, meeting.date),
              );
            for (const name of Object.values(names)) {
              await expect(
                page.getByRole("radio", { name, exact: true }),
              ).toHaveCount(1);
            }
            for (const view of ["week", "month", "semester"] as const) {
              await page
                .getByRole("radio", { name: names[view], exact: true })
                .click();
              if (view === "semester") {
                await expect(page).toHaveURL(
                  (url) =>
                    url.pathname === "/workspace/calendar" &&
                    url.searchParams.get("calendarSemester") ===
                      String(fixture.section.semesterId) &&
                    !url.searchParams.has("calendarView"),
                );
              } else {
                await expect(page).toHaveURL(
                  new RegExp(`calendarView=${view}`),
                );
              }
              await expect(
                page.getByRole("radio", { name: names[view], exact: true }),
              ).toBeChecked();
              await selectPeriod(page, locale, view, meeting.date);
              await expectDateRange(page, view, meeting.date, width);
              if (width === 1280) {
                // The date grid can render before its activity response inserts
                // records. Join the actual current module before hovering.
                const calendarModule = page
                  .getByTestId("workspace-calendar-mobile-toolbar")
                  .locator("xpath=ancestor::section[1]");
                await expect(calendarModule.getByRole("status")).toHaveCount(0);
                const grid = page.getByTestId("workspace-calendar-grid");
                const row = rowForDate(grid, page, meeting.date);
                await expect(row).toHaveCount(1);
                await expect(row.getByRole("rowheader")).toHaveText(
                  locale === "en-us"
                    ? `Week #${meeting.week}`
                    : `第 ${meeting.week} 周`,
                );
                const cell = row.getByRole("gridcell").filter({
                  has: page.getByText(meeting.date.slice(5), { exact: true }),
                });
                const course = cell.locator(
                  `a[href="/catalog/sections/${fixture.section.jwId}"]`,
                );
                await expect(course).toHaveCount(1);
                await expect(course).toContainText(title);
                await expect(course).toContainText("09:00");
                await expect(course).toContainText("10:00");
                await expect(course).toContainText(meeting.place);
                await course.hover();
                let contentId = "";
                await expect
                  .poll(async () => {
                    const observation = await course.evaluate(
                      (link, fields) => {
                        const id = link.getAttribute("aria-describedby");
                        const content = id ? document.getElementById(id) : null;
                        const linked =
                          content?.matches("[data-tooltip-content]") === true;
                        const style = content
                          ? getComputedStyle(content)
                          : null;
                        return {
                          id,
                          linked,
                          visible: Boolean(
                            content?.getClientRects().length &&
                              style?.visibility === "visible" &&
                              Number(style.opacity) > 0,
                          ),
                          complete: fields.every((field) =>
                            content?.textContent?.includes(field),
                          ),
                        };
                      },
                      [title, "09:00", "10:00", meeting.place],
                    );
                    contentId = observation.id ?? "";
                    return observation;
                  })
                  .toMatchObject({
                    id: expect.stringMatching(/\S+/),
                    linked: true,
                    visible: true,
                    complete: true,
                  });
                const tooltip = page.locator(
                  `[data-tooltip-content][id="${contentId}"]`,
                );
                await expect(tooltip).toContainText(title);
                await expect(tooltip).toContainText("09:00");
                await expect(tooltip).toContainText("10:00");
                await expect(tooltip).toContainText(meeting.place);
                await expectUnclipped(tooltip);
                await page.mouse.move(0, 0);
              } else {
                const agenda = page
                  .getByTestId("calendar-agenda")
                  .filter({ visible: true });
                const day = agenda.locator(
                  `section[aria-labelledby="agenda-${meeting.date}"]`,
                );
                await expect(day).toHaveCount(1);
                await expect(
                  day.locator(`#agenda-${meeting.date}`),
                ).toBeVisible();
                const course = day.locator(
                  `a[href="/catalog/sections/${fixture.section.jwId}"]`,
                );
                await expect(course).toHaveCount(1);
                await expect(
                  course.locator('[data-slot="item-title"]'),
                ).toHaveText(title);
                const description = course.locator(
                  '[data-slot="item-description"]',
                );
                await expect(description).toContainText("09:00");
                await expect(description).toContainText("10:00");
                await expect(description).toContainText(meeting.place);
                await course.scrollIntoViewIfNeeded();
                await expectUnclipped(
                  course.locator('[data-slot="item-title"]'),
                );
                await expectUnclipped(description);
                // Mobile has a date agenda, not a teaching-week rowheader.
                await expect(agenda.getByRole("rowheader")).toHaveCount(0);
              }
            }
          }
        },
        { accountIndex: 0, calendarTokenCreated: true },
      );
    });
  }

  for (const kind of [
    "nonpositive-stored-week",
    "conflicting-stored-weeks",
  ] as const) {
    test(`calendar.teaching-week-generic ${kind} ${locale}`, {
      tag: "@Calendar/Web",
    }, async ({ page, calendar: fixture, calendarDb, calendarRun }) => {
      // Schedule.weekIndex is a non-null Int. This real-DB case covers invalid
      // zero, not null/undefined; those branches remain covered by pure units.
      const rows =
        kind === "nonpositive-stored-week"
          ? [{ date: "2026-06-02", weekday: 2, week: 0 }]
          : [
              { date: "2026-05-19", weekday: 2, week: 5 },
              { date: "2026-05-20", weekday: 3, week: 6 },
            ];
      await calendarDb((db) =>
        db.schedule.createMany({
          data: rows.map((row) => ({
            sectionId: fixture.section.id,
            scheduleGroupId: fixture.group.id,
            date: new Date(`${row.date}T00:00:00Z`),
            weekday: row.weekday,
            weekIndex: row.week,
            startTime: 1100,
            endTime: 1200,
            startUnit: 3,
            endUnit: 4,
            periods: 2,
            customPlace: "Generic teaching room",
          })),
        }),
      );
      await calendarRun(
        async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await page.context().clearCookies();
          await page
            .context()
            .addCookies([
              await fixture.createSignedSessionCookie(fixture.users[0].id),
              { name: "NEXT_LOCALE", value: locale, url: fixture.origin },
            ]);
          const names = labels(locale);
          const anchor = rows[0];
          if (!anchor)
            throw new Error("Generic calendar fixture needs a meeting");
          await gotoAndWaitForReady(page, academicUrl(fixture, anchor.date));
          for (const view of ["week", "month", "semester"] as const) {
            await page
              .getByRole("radio", { name: names[view], exact: true })
              .click();
            if (view === "semester") {
              await expect(page).toHaveURL(
                (url) =>
                  url.pathname === "/workspace/calendar" &&
                  url.searchParams.get("calendarSemester") ===
                    String(fixture.section.semesterId) &&
                  !url.searchParams.has("calendarView"),
              );
            } else {
              await expect(page).toHaveURL(new RegExp(`calendarView=${view}`));
            }
            await selectPeriod(page, locale, view, anchor.date);
            await expectDateRange(page, view, anchor.date, 1280);
            const grid = page.getByTestId("workspace-calendar-grid");
            for (const meeting of rows) {
              const row = rowForDate(grid, page, meeting.date);
              await expect(row).toHaveCount(1);
              await expect(row.getByRole("rowheader")).toHaveText(
                locale === "en-us" ? "Week" : "周次",
              );
              const course = row
                .getByRole("gridcell")
                .filter({
                  has: page.getByText(meeting.date.slice(5), { exact: true }),
                })
                .locator(`a[href="/catalog/sections/${fixture.section.jwId}"]`);
              await expect(course).toHaveCount(1);
              await expect(course).toContainText("11:00");
              await expect(course).toContainText("12:00");
              await expect(course).toContainText("Generic teaching room");
            }
          }
        },
        { accountIndex: 0, calendarTokenCreated: true },
      );
    });
  }
}
