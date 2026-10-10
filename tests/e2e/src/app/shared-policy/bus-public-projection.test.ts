import { expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { User } from "../../../../../src/generated/prisma-node/client";
import { busTest } from "../../../utils/personal-preferences-fixture";

const test = busTest.extend<{ busUsers: User[] }>({
  busUsers: async (
    { isolatedWorker, preferenceFlow, busTimetable: _busTimetable },
    use,
  ) => {
    const owners = await preferenceFlow.prepare(() =>
      isolatedWorker.database.owner.$transaction(async (db) => {
        const owners: User[] = [];
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
        return owners;
      }),
    );
    await use(owners);
  },
});

test("bus.public-web-personal-overlay", { tag: "@Bus/Web" }, async ({
  preferenceFlow,
  baseURL,
  busUsers: users,
  isolatedWorker,
}) => {
  await preferenceFlow.run(async () => {
    if (!baseURL) throw new Error("Missing Playwright baseURL");
    for (const locale of ["zh-cn", "en-us"]) {
      let publicDestination = "";
      for (const owner of [null, ...users]) {
        const context = await preferenceFlow.newContext({
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
          const response = await preferenceFlow.http(() =>
            context.request.get("/catalog/bus", {
              headers: preferenceFlow.headers,
            }),
          );
          expect(response.status()).toBe(200);
          const html = await response.text();
          expect(html.includes("preferredOriginCampusId")).toBe(false);
          expect(html.includes("preferredDestinationCampusId")).toBe(false);
          const dataResponse = await preferenceFlow.http(() =>
            context.request.get("/catalog/bus/__data.json", {
              headers: preferenceFlow.headers,
            }),
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
          const page = await preferenceFlow.newPage(context);
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
            const privateResponse = await preferenceFlow.http(() =>
              context.request.get("/api/workspace/bus-preferences", {
                headers: preferenceFlow.headers,
              }),
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
          await preferenceFlow.closeContext(context);
        }
      }
    }
  }, "consume");
});
