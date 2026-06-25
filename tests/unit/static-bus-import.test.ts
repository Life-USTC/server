import { describe, expect, it } from "vitest";
import { buildBusPayload } from "../../tools/load/static-bus-import";
import type { StaticSnapshot } from "../../tools/load/static-snapshot";

function createSnapshot(overrides: Partial<StaticSnapshot> = {}) {
  return {
    listBusCampuses: () => [
      { id: 2, name: "West", latitude: 2, longitude: 20 },
      { id: 1, name: "East", latitude: 1, longitude: 10 },
    ],
    listBusRoutes: () => [{ id: 20 }, { id: 10 }],
    listBusRouteStops: () => [
      { route_id: 10, campus_id: 2, stop_order: 2 },
      { route_id: 10, campus_id: 1, stop_order: 1 },
      { route_id: 20, campus_id: 2, stop_order: 1 },
    ],
    listBusTrips: (dayType: "weekday" | "weekend") =>
      dayType === "weekday"
        ? [
            {
              schedule_id: 200,
              route_id: 20,
              position: 0,
              day_type: "weekday",
            },
            {
              schedule_id: 100,
              route_id: 10,
              position: 1,
              day_type: "weekday",
            },
            {
              schedule_id: 100,
              route_id: 10,
              position: 0,
              day_type: "weekday",
            },
          ]
        : [],
    listBusTripStopTimes: (dayType: "weekday" | "weekend") =>
      dayType === "weekday"
        ? [
            {
              schedule_id: 100,
              position: 0,
              stop_order: 2,
              departure_time: 830,
            },
            {
              schedule_id: 100,
              position: 0,
              stop_order: 1,
              departure_time: null,
            },
            {
              schedule_id: 100,
              position: 1,
              stop_order: 1,
              departure_time: 900,
            },
            {
              schedule_id: 200,
              position: 0,
              stop_order: 1,
              departure_time: 1000,
            },
          ]
        : [],
    getBusNotice: () => null,
    ...overrides,
  } as unknown as StaticSnapshot;
}

describe("static bus import", () => {
  it("builds a sorted bus payload with ordered route stops and trips", () => {
    const payload = buildBusPayload(createSnapshot());

    expect(payload.campuses.map((campus) => campus.id)).toEqual([1, 2]);
    expect(payload.routes.map((route) => route.id)).toEqual([10, 20]);
    expect(payload.routes[0].campuses.map((campus) => campus.id)).toEqual([
      1, 2,
    ]);
    expect(payload.weekday_routes.map((route) => route.id)).toEqual([100, 200]);
    expect(payload.weekday_routes[0].route.id).toBe(10);
    expect(payload.weekday_routes[0].time).toEqual([[null, 830], [900]]);
    expect(payload.weekend_routes).toEqual([]);
    expect(payload.message).toEqual({ message: "", url: "" });
  });

  it("preserves bus notice message and url", () => {
    const payload = buildBusPayload(
      createSnapshot({
        getBusNotice: () => ({
          message: "Temporary route change",
          url: "https://example.test/bus",
        }),
      }),
    );

    expect(payload.message).toEqual({
      message: "Temporary route change",
      url: "https://example.test/bus",
    });
  });

  it("rejects route stops with unknown campus ids", () => {
    expect(() =>
      buildBusPayload(
        createSnapshot({
          listBusRouteStops: () => [
            { route_id: 10, campus_id: 999, stop_order: 1 },
          ],
        }),
      ),
    ).toThrow("Unknown bus campus id 999");
  });

  it("rejects trips with unknown route ids", () => {
    expect(() =>
      buildBusPayload(
        createSnapshot({
          listBusTrips: () => [
            {
              schedule_id: 100,
              route_id: 999,
              position: 0,
              day_type: "weekday",
            },
          ],
        }),
      ),
    ).toThrow("Unknown bus route id 999");
  });
});
