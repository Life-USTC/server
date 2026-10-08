import { expect, type Page } from "@playwright/test";
import { expectNoPageHorizontalOverflow } from "../../../utils/page-ready";
import { busTest as test } from "../../../utils/personal-preferences-fixture";
import {
  busContractState,
  expectBusContractEffectsEmpty,
  expectBusContractGraph,
  test as privateTest,
} from "./bus-contract-fixture";

async function openPlanner(
  page: Page,
  width: number,
  locale: string,
  origin: string,
) {
  await page.setViewportSize({ width, height: 1000 });
  await page.clock.setFixedTime(new Date("2026-04-22T03:00:00Z"));
  await page
    .context()
    .addCookies([{ name: "NEXT_LOCALE", value: locale, url: origin }]);
  await page.goto("/catalog/bus");
  await expect(
    page
      .getByRole("button", { name: /Reverse|反向/ })
      .filter({ visible: true })
      .first(),
  ).toBeEnabled();
  await expect(page.getByTestId("bus-route-section").first()).toBeVisible();
}
async function openControls(page: Page) {
  const change = page.getByRole("button", { name: /Change route|调整路线/ });
  if (await change.isVisible()) await change.click();
  await expect(page.getByTestId("bus-start-stop-group")).toBeVisible();
}

test("bus.core-filters-only", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [1280, 390]) {
      await openPlanner(page, width, "en-us", isolatedWorker.origin);
      await openControls(page);
      const start = page.getByTestId("bus-start-stop-group");
      const end = page.getByTestId("bus-end-stop-group");
      await expect(
        start.getByRole("radio", { name: "东区", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        end.getByRole("radio", { name: "西区", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await page
        .getByRole("button", { name: "Reverse", exact: true })
        .filter({ visible: true })
        .last()
        .click();
      await expect(
        start.getByRole("radio", { name: "西区", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await expect(
        end.getByRole("radio", { name: "东区", exact: true }),
      ).toHaveAttribute("aria-checked", "true");
      await page
        .getByRole("button", { name: "Reverse", exact: true })
        .filter({ visible: true })
        .last()
        .click();
      for (const label of ["Saturday", "Sunday", "Weekday"]) {
        const option = page.getByRole("radio", { name: label, exact: true });
        await option.click();
        await expect(option).toHaveAttribute("aria-checked", "true");
      }
      const departed = page.getByRole("switch", {
        name: "Show departed trips",
        exact: true,
      });
      await departed.click();
      await expect(departed).toBeChecked();
      await expect(
        page.getByTestId("bus-route-section").filter({ hasText: "北区" }),
      ).toContainText("07:30");
      await departed.click();
      await expect(departed).not.toBeChecked();
      await end.getByRole("radio", { name: "南区", exact: true }).click();
      await expect(page.getByTestId("bus-route-section")).toHaveCount(1);
      await expect(page.getByTestId("bus-route-section")).toContainText("南区");
      await end.getByRole("radio", { name: "西区", exact: true }).click();
    }
  });
});

privateTest(
  "bus.merged-table-grouped-by-route",
  { tag: "@Bus/Web" },
  async ({ page, isolatedWorker, preferenceFlow, busOwner: owner, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const baseline = await busContractState(db);
      expectBusContractGraph(baseline, owner.id);
      expect(await db.busUserPreference.findMany()).toEqual([]);
      await expectBusContractEffectsEmpty(db);
      await preferenceFlow.run(async () => {
        for (const signedIn of [false, true]) {
          await page.context().clearCookies();
          if (signedIn) await page.context().addCookies([owner.cookie]);
          for (const width of [1280, 390]) {
            await openPlanner(page, width, "en-us", isolatedWorker.origin);
            const routes = page.getByTestId("bus-route-section");
            expect(await routes.count()).toBeGreaterThanOrEqual(2);

            await expect
              .soft(page.locator("table").filter({ visible: true }))
              .toHaveCount(1);
            for (const route of await routes.all()) {
              await expect(
                route.getByRole("heading", { level: 3 }),
              ).toBeVisible();
              expect(
                await route.locator("tbody tr, tr").count(),
              ).toBeGreaterThan(0);
            }
          }
        }
      });
      expect(await busContractState(db)).toEqual(baseline);
      expect(await db.busUserPreference.findMany()).toEqual([]);
      await expectBusContractEffectsEmpty(db);
    });
  },
);

test("bus.mobile-next-departures", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [280, 390]) {
      await openPlanner(page, width, "en-us", isolatedWorker.origin);
      const summary = page.getByTestId("bus-compact-summary");
      await expect(summary).toBeVisible();
      await expect(summary).toContainText("12:50");
      await expect(summary).toContainText("18:40");
      await expect(summary).toContainText("21:15");
      await expect(summary).not.toContainText("21:20");
      await expect(summary.locator('[data-slot="item"]')).toHaveCount(2);
      await expect(summary).toContainText("东区");
      await expect(summary).toContainText("西区");
      const summaryBox = await summary.boundingBox();
      const controlsBox = await page
        .getByRole("button", { name: "Change route", exact: true })
        .boundingBox();
      expect(
        summaryBox &&
          controlsBox &&
          summaryBox.y + summaryBox.height <= controlsBox.y,
      ).toBe(true);
    }
  });
});

test("bus.responsive-route-surfaces", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [280, 320, 390, 1280]) {
      await openPlanner(page, width, "en-us", isolatedWorker.origin);
      await openControls(page);
      await expectNoPageHorizontalOverflow(page);
      await page.goto("/catalog/bus/map");
      await expect(
        page.locator("text[data-campus-label]").first(),
      ).toBeVisible();
      await expectNoPageHorizontalOverflow(page);
    }
  });
});

test("bus.stop-label-wrapping", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [280, 390]) {
      await openPlanner(page, width, "en-us", isolatedWorker.origin);
      const sequences = page
        .locator('[data-slot="bus-route-description"]')
        .filter({ visible: true });
      expect(await sequences.count()).toBeGreaterThan(0);
      for (const sequence of await sequences.all()) {
        const tokens = await sequence
          .locator(":scope > span")
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              text: node.textContent?.trim(),
              whiteSpace: getComputedStyle(node).whiteSpace,
              rects: node.getClientRects().length,
            })),
          );
        expect(tokens.length).toBeGreaterThan(1);
        for (const [index, token] of tokens.entries()) {
          expect(token.whiteSpace).toBe("nowrap");
          expect(token.rects).toBe(1);
          expect(Boolean(token.text?.startsWith("→"))).toBe(index > 0);
        }
      }
    }
  });
});

test("bus.map-label-legibility", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/catalog/bus/map");
      const labels = page.locator("text[data-campus-label]");
      await expect(labels.first()).toBeVisible();
      const rendered = await labels.evaluateAll((nodes) =>
        nodes.map((node) => {
          const style = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          return {
            paintOrder: style.paintOrder,
            stroke: style.stroke,
            fill: style.fill,
            strokeWidth: Number.parseFloat(style.strokeWidth),
            width: box.width,
            height: box.height,
          };
        }),
      );
      expect(rendered.length).toBeGreaterThan(2);
      for (const label of rendered) {
        expect(label.paintOrder).toContain("stroke");
        expect(label.strokeWidth).toBeGreaterThanOrEqual(7);
        expect(label.stroke).not.toBe("none");
        expect(label.stroke).not.toBe(label.fill);
        expect(label.width).toBeGreaterThan(0);
        expect(label.height).toBeGreaterThan(0);
      }
    }
  });
});

test("bus.visual-priority", { tag: "@Bus/Web" }, async ({
  page,
  preferenceFlow,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    for (const width of [1280, 390]) {
      await openPlanner(page, width, "en-us", isolatedWorker.origin);
      if (width < 1024) {
        const summary = page.getByTestId("bus-compact-summary");
        await expect(summary).toContainText("12:50");
        await expect(summary).toContainText("东区");
        await expect(summary).toContainText("西区");
        const next = summary.getByText("12:50", { exact: true });
        expect(
          await next.evaluate((node) =>
            Number.parseFloat(getComputedStyle(node).fontSize),
          ),
        ).toBeGreaterThanOrEqual(36);
        const summaryBox = await summary.boundingBox();
        const tableBox = await page.locator("table").first().boundingBox();
        expect(
          summaryBox &&
            tableBox &&
            summaryBox.y + summaryBox.height <= tableBox.y,
        ).toBe(true);
      } else {
        await expect(
          page
            .getByTestId("bus-start-stop-group")
            .getByRole("radio", { name: "东区", exact: true }),
        ).toHaveAttribute("aria-checked", "true");
        await expect(
          page
            .getByTestId("bus-end-stop-group")
            .getByRole("radio", { name: "西区", exact: true }),
        ).toHaveAttribute("aria-checked", "true");
        const route = page.getByTestId("bus-route-section").first();
        await expect(route.getByRole("heading", { level: 3 })).toContainText(
          "东区",
        );
        await expect(route.getByRole("heading", { level: 3 })).toContainText(
          "西区",
        );
        const firstTrip = route
          .locator("tr")
          .filter({ has: page.locator("td") })
          .first();
        await expect(firstTrip).toContainText("12:50");
        await expect(firstTrip).toHaveClass(/bg-muted/);
      }
    }
  });
});
