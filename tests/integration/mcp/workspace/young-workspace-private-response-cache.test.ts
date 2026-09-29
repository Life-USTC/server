import { youngTransportTest as contractTest } from "../../../shared/young-transport-contract-fixture";

contractTest(
  "young-workspace.private-response-cache",
  async ({ state, expect, protocolRuntime }) => {
    await protocolRuntime.run(async () => {
      const {
        routes: {
          getYoungWorkspaceRoute,
          getYoungSubscriptionStateRoute,
          getYoungOrganizerStateRoute,
        },
      } = state;

      const { youngIds, organizers, request } = state;

      for (const index of [0, 1]) {
        for (const kind of ["events", "organizers", "notifications"] as const) {
          const response = await getYoungWorkspaceRoute(
            await request(index, "/api/workspace/young-event-subscriptions"),
            kind,
          );
          expect(
            response.status,
            JSON.stringify(await response.clone().json()),
          ).toBe(200);
          expect(response.headers.get("cache-control")).toBe(
            "private, no-store",
          );
          expect((await response.json()).data.length).toBeGreaterThan(0);
        }
        for (const response of [
          await getYoungSubscriptionStateRoute(
            await request(
              index,
              "/api/workspace/young-event-subscriptions/state",
            ),
            youngIds[index === 0 ? 0 : 3],
          ),
          await getYoungOrganizerStateRoute(
            await request(
              index,
              "/api/workspace/young-organizer-subscriptions/state",
            ),
            organizers[index],
          ),
        ]) {
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toBe(
            "private, no-store",
          );
          expect((await response.json()).subscribed).toBe(true);
        }
      }
    });
  },
);
