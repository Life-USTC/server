import { expect, type Page, test } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "../../../utils/e2e-db/core";
import { withE2ePrisma } from "../../../utils/e2e-db/prisma";
import { createSignedSessionCookie } from "../../../utils/signed-session-cookie";

async function createOwner() {
  const marker = crypto.randomUUID().slice(0, 8);
  return withE2ePrisma((db) =>
    db.user.create({
      data: {
        name: `bus-preferences-${marker}`,
        username: `bus-preferences-${marker}`,
        email: `bus-preferences-${marker}@example.test`,
        emailVerified: true,
        busPreference: {
          create: {
            preferredOriginCampusId: 1,
            preferredDestinationCampusId: 4,
            showDepartedTrips: true,
          },
        },
      },
    }),
  );
}
async function open(page: Page, userId?: string) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies([
      { name: "NEXT_LOCALE", value: "en-us", url: PLAYWRIGHT_BASE_URL },
      ...(userId ? [await createSignedSessionCookie(userId)] : []),
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

test("bus.preference-hydration-write-gate", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-04-22T03:00:00Z") });
  const owner = await createOwner();
  let release = () => {};
  try {
    for (const mode of ["held", "unauthorized", "failed"] as const) {
      let requests = 0;
      let read = () => {};
      const intercepted = new Promise<void>((resolve) => {
        read = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/workspace/bus-preferences", async (route) => {
        if (route.request().method() !== "GET") {
          requests += 1;
          await route.continue();
          return;
        }
        const response = await route.fetch();
        expect(response.status()).toBe(200);
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
      });
      await open(page, owner.id);
      await intercepted;
      await end(page, "高新").click();
      await page.clock.runFor(750);
      expect(requests).toBe(0);
      expect(
        await withE2ePrisma((db) =>
          db.busUserPreference.findUnique({ where: { userId: owner.id } }),
        ),
      ).toMatchObject({
        preferredOriginCampusId: 1,
        preferredDestinationCampusId: 4,
        showDepartedTrips: true,
      });
      if (mode === "held") {
        const response = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/workspace/bus-preferences") &&
            response.request().method() === "GET",
        );
        release();
        await response;
        await page.clock.runFor(100);
        expect(requests).toBe(0);
        await expect(end(page, "高新")).toHaveAttribute("aria-checked", "true");
        const saved = page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/workspace/bus-preferences") &&
            response.request().method() === "POST",
        );
        await end(page, "西区").click();
        await page.clock.runFor(750);
        expect((await saved).status()).toBe(200);
        expect(requests).toBe(1);
        expect(
          await withE2ePrisma((db) =>
            db.busUserPreference.findUnique({ where: { userId: owner.id } }),
          ),
        ).toMatchObject({
          preferredOriginCampusId: 1,
          preferredDestinationCampusId: 2,
        });
        await withE2ePrisma((db) =>
          db.busUserPreference.update({
            where: { userId: owner.id },
            data: {
              preferredOriginCampusId: 1,
              preferredDestinationCampusId: 4,
              showDepartedTrips: true,
            },
          }),
        );
      }
      await page.unrouteAll({ behavior: "wait" });
    }
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    await withE2ePrisma((db) => db.user.delete({ where: { id: owner.id } }));
  }
});

test("bus.recent-route-precedence", async ({ page }) => {
  const owner = await createOwner();
  const key = "life-ustc:recent-bus-route:v1";
  try {
    await open(page);
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
    await open(page, owner.id);
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
    await open(page);
    await expect(end(page, "西区")).toHaveAttribute("aria-checked", "true");
  } finally {
    await withE2ePrisma((db) => db.user.delete({ where: { id: owner.id } }));
  }
});
