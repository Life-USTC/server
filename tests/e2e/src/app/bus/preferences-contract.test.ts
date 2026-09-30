import { expect, type Page } from "@playwright/test";
import type { IsolatedWorker } from "../../../utils/isolated-worker";
import {
  busContractState,
  expectBusContractEffectsEmpty,
  expectBusContractGraph,
  test,
} from "./bus-contract-fixture";

async function open(
  page: Page,
  origin: string,
  owner?: Awaited<ReturnType<IsolatedWorker["createActor"]>>,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: "NEXT_LOCALE", value: "en-us", url: origin },
      ...(owner ? [owner.cookie] : []),
    ]);
  await page.goto("/catalog/bus");
  await expect(
    page
      .getByTestId("bus-end-stop-group")
      .getByRole("radio", { name: "西区", exact: true }),
  ).toBeEnabled();
}
const end = (page: Page, name: string) =>
  page
    .getByTestId("bus-end-stop-group")
    .getByRole("radio", { name, exact: true });

test("bus.preference-hydration-write-gate", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  busOwner: owner,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    await page.clock.install({ time: new Date("2026-04-22T03:00:00Z") });
    const initial = await db.busUserPreference.create({
      data: {
        userId: owner.id,
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 4,
        showDepartedTrips: true,
      },
    });
    const baseline = await busContractState(db);
    expectBusContractGraph(baseline, owner.id);
    await expectBusContractEffectsEmpty(db);
    let release = () => {};
    await preferenceFlow.run(async () => {
      for (const mode of ["held", "unauthorized", "failed"] as const) {
        let requests = 0;
        let reads = 0;
        let expectedReadPreference = {
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 4,
          showDepartedTrips: true,
        };
        let read = () => {};
        const intercepted = new Promise<void>((resolve) => {
          read = resolve;
        });
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        preferenceFlow.onClosing(release);
        await preferenceFlow.route(
          page,
          "**/api/workspace/bus-preferences",
          async (route) => {
            if (route.request().method() !== "GET") {
              expect(route.request().method()).toBe("POST");
              expect(route.request().postDataJSON()).toEqual({
                preferredOriginCampusId: 1,
                preferredDestinationCampusId: 2,
                showDepartedTrips: false,
              });
              requests += 1;
              await route.fallback();
              return;
            }
            const response = await route.fetch();
            expect(response.status()).toBe(200);
            await response.body();
            expect(await response.json()).toEqual({
              preference: expectedReadPreference,
            });
            reads += 1;
            read();
            if (mode === "held") {
              await held;
              await route.fulfill({ response });
            } else
              await route.fulfill({
                status: mode === "unauthorized" ? 401 : 503,
                contentType: "application/json",
                body: JSON.stringify({ error: "Preference read unavailable" }),
              });
          },
        );
        await open(page, isolatedWorker.origin, owner);
        await intercepted;
        await end(page, "高新").click();
        await page.clock.runFor(750);
        expect(requests).toBe(0);
        expect(
          await db.busUserPreference.findUnique({
            where: { userId: owner.id },
          }),
        ).toMatchObject({
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 4,
          showDepartedTrips: true,
        });
        if (mode === "held") {
          const response = preferenceFlow.waitForResponse(
            page,
            (response) =>
              response.url().endsWith("/api/workspace/bus-preferences") &&
              response.request().method() === "GET",
          );
          release();
          await (await response).body();
          await page.clock.runFor(100);
          expect(requests).toBe(0);
          await expect(end(page, "高新")).toHaveAttribute(
            "aria-checked",
            "true",
          );
          const saved = preferenceFlow.waitForResponse(
            page,
            (response) =>
              response.url().endsWith("/api/workspace/bus-preferences") &&
              response.request().method() === "POST",
          );
          await expect(
            page.getByRole("switch", {
              name: "Show departed trips",
              exact: true,
            }),
          ).not.toBeChecked();
          await end(page, "西区").click();
          await page.clock.runFor(750);
          const savedResponse = await saved;
          expect(savedResponse.status()).toBe(200);
          await savedResponse.body();
          expect(await savedResponse.json()).toEqual({
            preference: {
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 2,
              showDepartedTrips: false,
            },
          });
          expect(requests).toBe(1);
          expect(
            await db.busUserPreference.findUnique({
              where: { userId: owner.id },
            }),
          ).toMatchObject({
            preferredOriginCampusId: 1,
            preferredDestinationCampusId: 2,
            showDepartedTrips: false,
          });
          expectedReadPreference = {
            preferredOriginCampusId: 1,
            preferredDestinationCampusId: 2,
            showDepartedTrips: false,
          };
          const reloaded = preferenceFlow.waitForResponse(
            page,
            (response) =>
              response.url().endsWith("/api/workspace/bus-preferences") &&
              response.request().method() === "GET",
          );
          await page.reload();
          const reloadedResponse = await reloaded;
          expect(reloadedResponse.status()).toBe(200);
          await reloadedResponse.body();
          expect(await reloadedResponse.json()).toEqual({
            preference: expectedReadPreference,
          });
          await expect(end(page, "西区")).toHaveAttribute(
            "aria-checked",
            "true",
          );
          await expect(
            page.getByRole("switch", {
              name: "Show departed trips",
              exact: true,
            }),
          ).not.toBeChecked();
          expect(requests).toBe(1);
          await db.busUserPreference.update({
            where: { userId: owner.id },
            data: {
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 4,
              showDepartedTrips: true,
            },
          });
        }
        await preferenceFlow.clearRoutes(page);
        expect(reads).toBe(mode === "held" ? 2 : 1);
        expect(requests).toBe(mode === "held" ? 1 : 0);
      }
    }, "bus");
    expect(await busContractState(db)).toEqual(baseline);
    const final = await db.busUserPreference.findMany();
    expect(final).toEqual([{ ...initial, updatedAt: expect.any(Date) }]);
    expect(final[0].updatedAt.getTime()).toBeGreaterThanOrEqual(
      initial.updatedAt.getTime(),
    );
    expect(final[0].updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    await expectBusContractEffectsEmpty(db);
  });
});

test("bus.recent-route-precedence", async ({
  page,
  isolatedWorker,
  preferenceFlow,
  busOwner: owner,
  run,
}) => {
  await run(async () => {
    const db = isolatedWorker.database.owner;
    const initial = await db.busUserPreference.create({
      data: {
        userId: owner.id,
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 4,
        showDepartedTrips: true,
      },
    });
    const baseline = await busContractState(db);
    expectBusContractGraph(baseline, owner.id);
    await expectBusContractEffectsEmpty(db);
    const key = "life-ustc:recent-bus-route:v1";
    await preferenceFlow.run(async () => {
      await open(page, isolatedWorker.origin);
      await page.evaluate(
        (key) =>
          localStorage.setItem(
            key,
            JSON.stringify({ startCampusId: 1, endCampusId: 6 }),
          ),
        key,
      );
      await page.reload();
      await expect(end(page, "高新")).toHaveAttribute("aria-checked", "true");
      await open(page, isolatedWorker.origin, owner);
      await expect(end(page, "南区")).toHaveAttribute("aria-checked", "true");
      expect(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
          key,
        ),
      ).toEqual({ startCampusId: 1, endCampusId: 6 });
      await page.evaluate(
        (key) =>
          localStorage.setItem(
            key,
            JSON.stringify({ startCampusId: -1, endCampusId: -2 }),
          ),
        key,
      );
      await open(page, isolatedWorker.origin);
      await expect(end(page, "西区")).toHaveAttribute("aria-checked", "true");
    });
    expect(await busContractState(db)).toEqual(baseline);
    expect(await db.busUserPreference.findMany()).toEqual([initial]);
    await expectBusContractEffectsEmpty(db);
  });
});
