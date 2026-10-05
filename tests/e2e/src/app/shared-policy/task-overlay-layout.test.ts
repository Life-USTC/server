import { expect, type Locator, type Page } from "@playwright/test";
import type { TestPrismaClient } from "../../../../shared/prisma";
import {
  type CalendarFixture,
  test,
} from "../../../utils/calendar-presentation-fixture";

async function fixture(
  page: Page,
  data: CalendarFixture,
  calendarDb: <T>(work: (db: TestPrismaClient) => Promise<T>) => Promise<T>,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      await data.createSignedSessionCookie(data.users[0].id),
      { name: "NEXT_LOCALE", value: "en-us", url: data.origin },
    ]);
  const content = `${Array.from(
    { length: 35 },
    (_, i) =>
      `Reading paragraph ${i}: independently verifiable task instructions.`,
  ).join("\n\n")}\n\nReading end marker.`;
  const complete = await calendarDb((client) =>
    client.$transaction(async (db) => {
      await db.homework.update({
        where: { id: data.homework.id },
        data: {
          publishedAt: new Date("2026-01-01T09:10:00+08:00"),
          submissionStartAt: new Date("2026-01-02T10:20:00+08:00"),
          submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
          description: { create: { content } },
        },
      });
      await db.todo.update({
        where: { id: data.todo.id },
        data: { content, dueAt: new Date("2099-01-03T12:30:00+08:00") },
      });
      const complete = await db.homework.create({
        data: {
          sectionId: data.section.id,
          title: `Completed ${data.homework.title}`,
          submissionDueAt: new Date("2099-01-03T12:30:00+08:00"),
          homeworkCompletions: { create: { userId: data.users[0].id } },
        },
      });
      return complete;
    }),
  );
  return {
    ...data,
    complete,
  };
}
async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected visible task layout bounds");
  return box;
}

test("homework.mobile-status-controls", { tag: "@Homework/Web" }, async ({
  page,
  calendar,
  calendarDb,
  calendarRun,
}) => {
  await calendarRun(
    async () => {
      const data = await fixture(page, calendar, calendarDb);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/workspace/homeworks");
        const cards = page.getByTestId("workspace-homeworks-cards");
        for (const [label, expected] of [
          ["Incomplete", [data.homework.title]],
          ["Completed", [data.complete.title]],
          ["All", [data.homework.title, data.complete.title]],
        ] as const) {
          const filter = page.getByRole("radio", { name: label, exact: true });
          await expect(filter).toBeVisible();
          const box = await bounds(filter);
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          await filter.click();
          await expect(filter).toBeChecked();
          for (const title of [data.homework.title, data.complete.title]) {
            const button = cards.getByRole("button", {
              name: title,
              exact: true,
            });
            if ((expected as readonly string[]).includes(title))
              await expect(button).toBeVisible();
            else await expect(button).toHaveCount(0);
          }
        }
        const create = page.getByTestId("workspace-homeworks-add");
        await expect(create).toBeEnabled();
        const box = await bounds(create);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        await expect(
          page.getByTestId("workspace-homeworks-view-menu"),
        ).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
    { accountIndex: 0, calendarTokenCreated: false },
  );
});

for (const [domain, kind] of [
  ["Homework", "homework"],
  ["Todo", "todo"],
] as const) {
  test(`ui.layout-principles-5 ${domain}`, { tag: `@${domain}/Web` }, async ({
    page,
    calendar,
    calendarDb,
    calendarRun,
  }) => {
    await calendarRun(
      async () => {
        const data = await fixture(page, calendar, calendarDb);
        for (const width of [1280, 390, 320]) {
          await page.setViewportSize({ width, height: 700 });
          {
            const title =
              kind === "homework" ? data.homework.title : data.todo.title;
            await page.goto(
              kind === "homework" ? "/workspace/homeworks" : "/workspace/todos",
            );
            const surface =
              kind === "homework"
                ? page.getByTestId(
                    width >= 768
                      ? "workspace-homeworks-list"
                      : "workspace-homeworks-cards",
                  )
                : width >= 768
                  ? page.getByRole("table")
                  : page.getByTestId("workspace-todos-cards");
            await surface
              .getByRole("button", { name: title, exact: true })
              .click();
            const dialog = page.getByRole("dialog", {
              name: title,
              exact: true,
            });
            await expect(dialog).toBeVisible();
            const heading = dialog.getByRole("heading", {
              name: title,
              exact: true,
            });
            const scroll = dialog.locator('[data-slot="scroll-area-viewport"]');
            await expect(scroll).toHaveCount(1);
            const summary = dialog.getByTestId(
              kind === "homework"
                ? "homework-deadline-summary"
                : "todo-detail-summary",
            );
            const due = summary.locator(":scope > p").nth(1);
            const relative = summary.locator(":scope > p").nth(2);
            const facts =
              kind === "homework"
                ? dialog.getByTestId("homework-secondary-details")
                : summary.getByRole("table");
            const reading = dialog.getByText(
              "Reading paragraph 0: independently verifiable task instructions.",
              { exact: true },
            );
            await expect(due).toHaveText(
              kind === "homework"
                ? "1/3/99, 12:30 PM"
                : "Jan 3, 2099, 12:30 PM",
            );
            await expect(relative).toContainText(/left/);
            // Compare only the two deadline values in this summary, in one
            // rendered sample. The dialog title is not their local style baseline.
            const deadlineStyles = await summary
              .locator(":scope > p")
              .evaluateAll(async (paragraphs) => {
                await document.fonts.ready;
                return paragraphs.slice(1, 3).map((paragraph) => {
                  const style = getComputedStyle(paragraph);
                  return {
                    size: Number.parseFloat(style.fontSize),
                    weight: Number.parseInt(style.fontWeight, 10),
                    color: style.color,
                  };
                });
              });
            expect(deadlineStyles).toHaveLength(2);
            const [dueStyle, relativeStyle] = deadlineStyles;
            expect(relativeStyle.size).toBeLessThanOrEqual(dueStyle.size);
            expect(relativeStyle.weight).toBeLessThanOrEqual(dueStyle.weight);
            expect(
              relativeStyle.size < dueStyle.size ||
                relativeStyle.weight < dueStyle.weight ||
                relativeStyle.color !== dueStyle.color,
              "relative urgency must retain distinct supporting emphasis",
            ).toBe(true);
            const parts = await Promise.all(
              [due, relative, facts, reading].map(bounds),
            );
            for (let index = 1; index < parts.length; index++) {
              expect(parts[index].y).toBeGreaterThanOrEqual(
                parts[index - 1].y + parts[index - 1].height - 1,
              );
              expect(Math.abs(parts[index].x - parts[0].x)).toBeLessThanOrEqual(
                1,
              );
            }
            const initialHeading = await bounds(heading);
            const footer = dialog.locator('[data-slot="dialog-footer"]');
            await expect(heading).toBeInViewport();
            await expect(footer).toBeInViewport();
            expect(
              await scroll.evaluate(
                (node) => node.scrollHeight - node.clientHeight,
              ),
            ).toBeGreaterThan(500);
            await scroll.hover();
            await page.mouse.wheel(0, 1200);
            await expect
              .poll(() => scroll.evaluate((node) => node.scrollTop))
              .toBeGreaterThan(500);
            await expect(heading).toBeInViewport();
            expect((await bounds(heading)).y).toBe(initialHeading.y);
            const end = dialog.getByText("Reading end marker.", {
              exact: true,
            });
            await end.scrollIntoViewIfNeeded();
            await expect(end).toBeInViewport();
            if (kind === "homework") {
              const discussion = dialog
                .getByTestId("homework-discussion")
                .getByRole("heading", {
                  name: "Homework discussion",
                  exact: true,
                });
              await discussion.scrollIntoViewIfNeeded();
              await expect(discussion).toBeInViewport();
              expect((await bounds(discussion)).y).toBeGreaterThan(
                (await bounds(end)).y,
              );
            }
            await expect(heading).toBeInViewport();
            expect((await bounds(heading)).y).toBe(initialHeading.y);
            await expect(footer).toBeInViewport();
            for (const action of await footer.getByRole("button").all()) {
              await expect(action).toBeEnabled();
              await action.focus();
              await expect(action).toBeFocused();
              await expect(action).toBeInViewport();
            }
            expect(
              await dialog.evaluate(
                (node) => node.scrollWidth <= node.clientWidth,
              ),
            ).toBe(true);
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
          }
        }
      },
      { accountIndex: 0, calendarTokenCreated: false },
    );
  });
}
