import { expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { User } from "../../../../../src/generated/prisma-node/client";
import { busTest } from "../../../utils/personal-preferences-fixture";

const test = busTest.extend<{ busUsers: User[] }>({
  busUsers: async ({ isolatedWorker, busTimetable: _busTimetable }, use) => {
    const db = isolatedWorker.database.owner;
    const owners = [];
    for (const destination of [4, 6]) {
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
      owners.push(
        await db.user.create({
          data: {
            name: `Private bus ${suffix}`,
            username: `bus${suffix}`,
            email: `bus-${suffix}@example.test`,
            busPreference: {
              create: {
                preferredOriginCampusId: 1,
                preferredDestinationCampusId: destination,
                showDepartedTrips: true,
              },
            },
          },
        }),
      );
    }
    await use(owners);
  },
});

test("bus.public-web-personal-overlay", async ({
  browser,
  baseURL,
  busUsers: users,
  isolatedWorker,
}) => {
  if (!baseURL) throw new Error("Missing Playwright baseURL");
  for (const locale of ["zh-cn", "en-us"]) {
    let publicDestination = "";
    for (const owner of [null, ...users]) {
      const context = await browser.newContext({
        baseURL,
        javaScriptEnabled: false,
      });
      try {
        await context.addCookies([
          { name: "NEXT_LOCALE", value: locale, url: baseURL },
          ...(owner
            ? [(await isolatedWorker.createSession(owner.id)).cookie]
            : []),
        ]);
        const response = await context.request.get("/catalog/bus");
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html.includes("preferredOriginCampusId")).toBe(false);
        expect(html.includes("preferredDestinationCampusId")).toBe(false);
        const dataResponse = await context.request.get(
          "/catalog/bus/__data.json",
        );
        expect(dataResponse.status()).toBe(200);
        const envelope = await dataResponse.json();
        const projections = envelope.nodes
          .filter((node: { type: string }) => node.type === "data")
          .map((node: { data: unknown[] }) => unflatten(node.data));
        const projection = projections.find(
          (data: { bus?: unknown }) => data.bus,
        );
        expect(projection.signedIn).toBe(false);
        expect(projection.bus.preferences).toBeNull();
        expect(projection.bus.routes.length).toBeGreaterThan(0);
        expect(projection.bus.trips.length).toBeGreaterThan(0);
        const page = await context.newPage();
        await page.goto("/catalog/bus", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const selectedDestination = page
          .getByTestId("bus-end-stop-group")
          .locator('[role="radio"][aria-checked="true"]');
        await expect(selectedDestination).toHaveCount(1);
        const destinationLabel =
          (await selectedDestination.textContent())?.trim() ?? "";
        expect(destinationLabel).not.toBe("");
        if (owner) expect(destinationLabel).toBe(publicDestination);
        else publicDestination = destinationLabel;
        if (owner) {
          const privateResponse = await context.request.get(
            "/api/workspace/bus-preferences",
          );
          expect(privateResponse.status()).toBe(200);
          expect(privateResponse.headers()["cache-control"]).toBe(
            "private, no-store",
          );
          const privateData = await privateResponse.json();
          expect(privateData.preference).toMatchObject({
            preferredOriginCampusId: 1,
            preferredDestinationCampusId: owner.id === users[0].id ? 4 : 6,
            showDepartedTrips: true,
          });
        }
      } finally {
        await context.close();
      }
    }
  }
});
