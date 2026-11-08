import { describe, expect, it } from "vitest";
import {
  DEMO_BUS_HUB,
  DEMO_BUS_VERSION,
  getDemoBusMap,
  getDemoBusNext,
  getDemoBusRoutes,
  getDemoBusTimetable,
  isDemoBusTime,
} from "@/features/demo/server/demo-bus";
import { getDemoHomeCampusNow } from "@/features/demo/server/demo-home";
import { getDemoWeatherSnapshot } from "@/features/demo/server/demo-weather";

const reference = "2026-09-24T09:00:00+08:00";
const departures = ["09:05", "09:20", "09:35", "09:50", "10:05"];

for (const locale of ["en-us", "zh-cn"] as const) {
  describe(`sealed campus fixtures: ${locale}`, () => {
    it("keeps both weather locations fictional, bounded and on the fixed Shanghai clock", () => {
      for (const [index, key] of (
        ["ustc-main", "ustc-gaoxin"] as const
      ).entries()) {
        const weather = getDemoWeatherSnapshot(key, locale);
        expect(weather.location.key).toBe(key);
        expect(weather.fetchedAt).toBe(reference);
        expect(weather.current.temperature).toBe(24 + index);
        expect(weather.current.condition.text).toMatch(
          locale === "en-us" ? /Fictional/ : /虚构/,
        );
        expect(weather.providers).toEqual([]);
        expect(weather.current.condition.icon).toBe("wmo-0");
        expect(weather.current.source).toBeUndefined();
        expect(weather.current.observedAt).toBeUndefined();
        expect(weather.extensions).toEqual({});
        expect(weather.hourly).toHaveLength(12);
        expect(weather.daily).toHaveLength(7);
        expect(weather.hourly.slice(0, 3).map((hour) => hour.at)).toEqual([
          "2026-09-24T09:00:00+08:00",
          "2026-09-24T10:00:00+08:00",
          "2026-09-24T11:00:00+08:00",
        ]);
        expect(weather.daily.map((day) => day.date)).toEqual([
          "2026-09-24",
          "2026-09-25",
          "2026-09-26",
          "2026-09-27",
          "2026-09-28",
          "2026-09-29",
          "2026-09-30",
        ]);
        for (const hour of weather.hourly) {
          expect(hour.temperature).toBeGreaterThanOrEqual(
            weather.daily[0].temperatureLow,
          );
          expect(hour.temperature).toBeLessThanOrEqual(
            weather.daily[0].temperatureHigh,
          );
        }
      }
    });

    it("uses one closed bus graph for each service day and its schematic map", () => {
      const data = getDemoBusTimetable(locale);
      const map = getDemoBusMap(locale);
      if (!data?.version || !map) throw new Error("Missing sealed bus fixture");
      expect(data.version.key).toBe(DEMO_BUS_VERSION);
      expect(data.availableVersions.map((version) => version.key)).toEqual([
        DEMO_BUS_VERSION,
      ]);
      expect(data.fetchedAt).toBe(reference);
      expect(data.preferences).toBeNull();
      expect(data.notice?.message).toMatch(
        locale === "en-us" ? /Fictional/ : /虚构/,
      );
      const campusIds = new Set(data.campuses.map((campus) => campus.id));
      expect(campusIds.size).toBe(6);
      expect(data.routes).toHaveLength(5);
      for (const dayType of ["weekday", "saturday", "sunday"] as const) {
        const trips = data.trips.filter((trip) => trip.dayType === dayType);
        expect(trips.map((trip) => trip.departureTime)).toEqual(departures);
        for (const trip of trips) {
          const route = data.routes.find((route) => route.id === trip.routeId);
          if (!route) throw new Error("Fixture trip has no route");
          expect(trip.stopTimes.map((stop) => stop.campusId)).toEqual(
            route.stops.map((stop) => stop.campus.id),
          );
          for (const stop of trip.stopTimes)
            expect(campusIds.has(stop.campusId)).toBe(true);
          expect(trip.stopTimes[0].time).toBe(trip.departureTime);
          expect(trip.stopTimes.at(-1)?.time).toBe(trip.arrivalTime);
        }
      }
      expect(map.now).toBe(reference);
      expect(map.todayType).toBe("weekday");
      expect(map.campuses.map((campus) => campus.id)).toEqual([...campusIds]);
      expect(map.routes.map((route) => route.routeId)).toEqual(
        data.routes.map((route) => route.id),
      );
      expect(map.activeTrips.map((trip) => trip.departureTime)).toEqual(
        departures.slice(0, 4),
      );
      for (const edge of map.routes) {
        expect(edge.weekdayTrips).toBe(1);
        expect(edge.saturdayTrips).toBe(1);
        expect(edge.sundayTrips).toBe(1);
        for (const stop of edge.stops)
          expect(campusIds.has(stop.campusId)).toBe(true);
      }
    });

    it("derives next departures from the fixed time and supports explicit read-only browsing", () => {
      const input = {
        originCampusId: DEMO_BUS_HUB,
        destinationCampusId: DEMO_BUS_HUB + 1,
      };
      expect(getDemoBusNext(locale, input)).toMatchObject({
        atTime: "2026-09-24T01:00:00.000Z",
        dayType: "weekday",
        departures: [{ departureTime: "09:05", minutesUntilDeparture: 5 }],
      });
      expect(
        getDemoBusNext(locale, {
          ...input,
          atTime: "2026-09-27T09:00:00+08:00",
        }),
      ).toMatchObject({
        dayType: "sunday",
        departures: [{ departureTime: "09:05", dayType: "sunday" }],
      });
      const afterDeparture = {
        ...input,
        atTime: "2026-09-24T09:06:00+08:00",
      };
      expect(getDemoBusNext(locale, afterDeparture)?.departures).toEqual([]);
      expect(
        getDemoBusNext(locale, {
          ...afterDeparture,
          includeDeparted: true,
        })?.departures,
      ).toMatchObject([{ departureTime: "09:05", minutesUntilDeparture: -1 }]);
    });

    it("rejects foreign versions, campus IDs and times outside the fixture", () => {
      const input = {
        originCampusId: DEMO_BUS_HUB,
        destinationCampusId: DEMO_BUS_HUB + 1,
      };
      for (const versionKey of ["production-current", "", "demo-other"]) {
        expect(getDemoBusTimetable(locale, versionKey)).toBeNull();
        expect(getDemoBusMap(locale, versionKey)).toBeNull();
        expect(getDemoBusRoutes(locale, { versionKey })).toBeNull();
        expect(getDemoBusNext(locale, { ...input, versionKey })).toBeNull();
      }
      expect(
        getDemoBusNext(locale, { ...input, originCampusId: 1 }),
      ).toBeNull();
      expect(
        getDemoBusNext(locale, { ...input, destinationCampusId: 1 }),
      ).toBeNull();
      for (const atTime of [
        "",
        "not-a-date",
        "2026-08-31T23:59:59+08:00",
        "2027-02-01T00:00:00+08:00",
      ])
        expect(getDemoBusNext(locale, { ...input, atTime })).toBeNull();
    });

    it("filters routes by travel direction without treating a real campus as a fixture", () => {
      expect(getDemoBusRoutes(locale, {})?.total).toBe(5);
      expect(
        getDemoBusRoutes(locale, {
          originCampusId: DEMO_BUS_HUB,
          destinationCampusId: DEMO_BUS_HUB + 1,
        }),
      ).toMatchObject({
        total: 1,
        routes: [{ destinationCampus: { id: DEMO_BUS_HUB + 1 } }],
      });
      expect(
        getDemoBusRoutes(locale, {
          originCampusId: DEMO_BUS_HUB + 1,
          destinationCampusId: DEMO_BUS_HUB,
        }),
      ).toMatchObject({ total: 0, routes: [] });
      expect(getDemoBusRoutes(locale, { originCampusId: 1 })).toBeNull();
      expect(getDemoBusRoutes(locale, { destinationCampusId: 1 })).toBeNull();
    });

    it("keeps Home readings and departures consistent with the complete pages", () => {
      const home = getDemoHomeCampusNow(locale);
      const data = getDemoBusTimetable(locale);
      if (!home.weather || !home.bus || !data)
        throw new Error("Missing shared campus projections");
      expect(home.weather.map((weather) => weather.temperature)).toEqual([
        "24°C",
        "25°C",
      ]);
      for (const tile of home.weather) {
        const weather = getDemoWeatherSnapshot(tile.locationKey, locale);
        expect(tile.condition).toBe(weather.current.condition.text);
        expect(tile.rangeLabel).toBe(
          `${weather.daily[0].temperatureLow}–${weather.daily[0].temperatureHigh}°C`,
        );
        expect(tile.hourly.map((hour) => hour.temperature)).toEqual(
          weather.hourly.slice(0, 3).map((hour) => `${hour.temperature}°C`),
        );
      }
      expect(home.bus.departures.map((trip) => trip.departureTime)).toEqual(
        departures,
      );
      expect(home.bus.departures.map((trip) => trip.destination)).toEqual(
        data.campuses.slice(1).map((campus) => campus.namePrimary),
      );
      expect(home.bus.departures.map((trip) => trip.relativeLabel)).toEqual(
        [5, 20, 35, 50, 65].map((minutes) =>
          locale === "en-us" ? `In ${minutes} min` : `${minutes} 分钟后`,
        ),
      );
    });
  });
}

it("keeps fixture bounds inclusive and does not share mutable request data", () => {
  expect(isDemoBusTime("2026-09-01T00:00:00+08:00")).toBe(true);
  expect(isDemoBusTime("2027-01-31T23:59:59+08:00")).toBe(true);
  const weather = getDemoWeatherSnapshot("ustc-main", "en-us");
  const bus = getDemoBusTimetable("en-us");
  if (!bus) throw new Error("Missing sealed bus fixture");
  weather.current.temperature = 999;
  weather.hourly[0].temperature = 999;
  bus.campuses[0].namePrimary = "Private ordinary user's selection";
  bus.trips[0].stopTimes[0].time = "23:59";
  expect(getDemoWeatherSnapshot("ustc-main", "en-us").current.temperature).toBe(
    24,
  );
  expect(
    getDemoWeatherSnapshot("ustc-main", "en-us").hourly[0].temperature,
  ).toBe(24);
  expect(getDemoBusTimetable("en-us")?.campuses[0].namePrimary).toBe(
    "Sample Campus",
  );
  expect(getDemoBusTimetable("en-us")?.trips[0].stopTimes[0].time).toBe(
    "09:05",
  );
});
