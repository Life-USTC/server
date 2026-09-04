/**
 * MCP seeded tools — 种子工具：校车时刻与线路
 */

import { expect, test } from "@playwright/test";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { parseTextContent } from "./helpers";
import { closeSeededMcpSession, openSeededMcpSession } from "./seeded-session";

test.describe("/api/mcp - 种子工具覆盖", () => {
  test.describe.configure({ mode: "serial" });

  test("种子工具：校车时刻与线路", async ({ page, request }) => {
    const session = await openSeededMcpSession(page, request);
    const mcpClient = session.client;

    try {
      let busResult: Awaited<ReturnType<typeof mcpClient.callTool>> | undefined;
      let busPayload:
        | {
            fetchedAt?: string;
            version?: { title?: string | null };
            counts?: {
              routes?: number;
              weekdayTrips?: number;
              saturdayTrips?: number;
              sundayTrips?: number;
            };
            routes?: Array<{ id?: number | null }>;
            nextDepartures?: Array<{
              routeId?: number;
              departureTime?: string | null;
            }>;
            trips?: Array<{
              dayType?: string;
              stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
            }>;
            preferences?: {
              preferredOriginCampusId?: number | null;
              preferredDestinationCampusId?: number | null;
              showDepartedTrips?: boolean;
            } | null;
          }
        | undefined;
      await expect(async () => {
        busResult = await mcpClient.callTool({
          name: "catalog_bus_timetable_get",
          arguments: {
            locale: "zh-cn",
          },
        });
        busPayload = parseTextContent(busResult) as typeof busPayload;
        expect(typeof busPayload?.fetchedAt).toBe("string");
        expect(busPayload?.version?.title).toContain(DEV_SEED.bus.versionTitle);
        expect(typeof busPayload?.counts?.routes).toBe("number");
        expect(
          busPayload?.routes?.some(
            (route) => route.id === DEV_SEED.bus.routeId,
          ),
        ).toBe(true);
        expect(busPayload?.trips).toBeUndefined();
        expect(busPayload?.preferences).toBeNull();
      }).toPass({
        timeout: 10_000,
        intervals: [250, 500, 1_000],
      });
      if (!busPayload) {
        throw new Error("catalog_bus_timetable_get returned no payload");
      }

      const busFullResult = await mcpClient.callTool({
        name: "catalog_bus_timetable_get",
        arguments: {
          locale: "zh-cn",
          mode: "full",
        },
      });
      const busFullPayload = parseTextContent(busFullResult) as {
        routes?: Array<{ id?: number | null }>;
        trips?: Array<{
          dayType?: string;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
      };
      expect(
        busFullPayload.routes?.some(
          (route) => route.id === DEV_SEED.bus.routeId,
        ),
      ).toBe(true);
      expect(
        busFullPayload.trips?.some(
          (trip) =>
            trip.dayType === "weekday" ||
            trip.dayType === "saturday" ||
            trip.dayType === "sunday",
        ),
      ).toBe(true);
      expect(
        busFullPayload.trips?.some(
          (trip) =>
            Array.isArray(trip.stopTimes) &&
            trip.stopTimes.some(
              (stopTime) => typeof stopTime.stopOrder === "number",
            ),
        ),
      ).toBe(true);

      const busSummaryResult = await mcpClient.callTool({
        name: "catalog_bus_timetable_get",
        arguments: {
          locale: "zh-cn",
          mode: "summary",
        },
      });
      const busSummaryPayload = parseTextContent(busSummaryResult) as {
        counts?: {
          routes?: number;
          weekdayTrips?: number;
          saturdayTrips?: number;
          sundayTrips?: number;
        };
        nextDepartures?: Array<{
          routeId?: number;
          departureTime?: string | null;
        }>;
        nextDeparturesMessage?: string | null;
        campuses?: unknown[];
        routes?: unknown[];
        trips?: unknown;
      };
      expect(typeof busSummaryPayload.counts?.routes).toBe("number");
      expect(typeof busSummaryPayload.counts?.weekdayTrips).toBe("number");
      expect(typeof busSummaryPayload.counts?.saturdayTrips).toBe("number");
      expect(typeof busSummaryPayload.counts?.sundayTrips).toBe("number");
      expect(busSummaryPayload.nextDepartures).toEqual([]);
      expect(Array.isArray(busSummaryPayload.campuses)).toBe(true);
      expect(Array.isArray(busSummaryPayload.routes)).toBe(true);
      expect(busSummaryPayload.trips).toBeUndefined();
      expect(busResult).toBeDefined();
      expect(typeof busSummaryPayload.nextDeparturesMessage).toBe("string");

      // catalog_bus_route_list — lightweight route catalog
      const listRoutesResult = await mcpClient.callTool({
        name: "catalog_bus_route_list",
        arguments: { locale: "zh-cn" },
      });
      const listRoutesPayload = parseTextContent(listRoutesResult) as {
        routes?: Array<{
          id?: number;
          stops?: Array<{ campusId?: number }>;
        }>;
        campuses?: Array<{ id?: number }>;
      };
      expect(Array.isArray(listRoutesPayload.routes)).toBe(true);
      expect(listRoutesPayload.routes?.length).toBeGreaterThan(0);
      expect(Array.isArray(listRoutesPayload.campuses)).toBe(true);
      expect(
        listRoutesPayload.routes?.some((r) => r.id === DEV_SEED.bus.routeId),
      ).toBe(true);
      const queryRouteIds = new Set(
        (busPayload.routes ?? [])
          .map((route) => route.id)
          .filter((routeId): routeId is number => typeof routeId === "number"),
      );
      const listedRouteIds = new Set(
        (listRoutesPayload.routes ?? [])
          .map((route) => route.id)
          .filter((routeId): routeId is number => typeof routeId === "number"),
      );
      expect(listedRouteIds.size).toBeGreaterThan(0);
      expect(
        [...listedRouteIds].every((routeId) => queryRouteIds.has(routeId)),
      ).toBe(true);

      // catalog_bus_route_get — full weekday+Saturday+Sunday for one route
      const timetableResult = await mcpClient.callTool({
        name: "catalog_bus_route_get",
        arguments: {
          routeId: DEV_SEED.bus.routeId,
          locale: "zh-cn",
        },
      });
      const timetablePayload = parseTextContent(timetableResult) as {
        route?: { id?: number };
        weekday?: Array<{
          position?: number;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
        saturday?: Array<{
          position?: number;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
        sunday?: Array<{
          position?: number;
          stopTimes?: Array<{ stopOrder?: number; time?: string | null }>;
        }>;
        alternateRoutes?: Array<{ id?: number }>;
      };
      expect(timetablePayload.route?.id).toBe(DEV_SEED.bus.routeId);
      expect(Array.isArray(timetablePayload.weekday)).toBe(true);
      expect(Array.isArray(timetablePayload.saturday)).toBe(true);
      expect(Array.isArray(timetablePayload.sunday)).toBe(true);
      expect(Array.isArray(timetablePayload.alternateRoutes)).toBe(true);
      expect(
        timetablePayload.weekday?.some(
          (trip) =>
            Array.isArray(trip.stopTimes) &&
            trip.stopTimes.some(
              (stopTime) => typeof stopTime.stopOrder === "number",
            ),
        ),
      ).toBe(true);

      const searchRoutesResult = await mcpClient.callTool({
        name: "catalog_bus_route_search",
        arguments: {
          locale: "zh-cn",
          originCampusId: DEV_SEED.bus.originCampusId,
          destinationCampusId: DEV_SEED.bus.destinationCampusId,
        },
      });
      const searchRoutesPayload = parseTextContent(searchRoutesResult) as {
        total?: number;
        routes?: Array<{ id?: number }>;
      };
      expect(searchRoutesPayload.total).toBeGreaterThan(0);
      expect(
        searchRoutesPayload.routes?.some(
          (route) => route.id === DEV_SEED.bus.recommendedRouteId,
        ),
      ).toBe(true);

      const nextBusesResult = await mcpClient.callTool({
        name: "catalog_bus_departure_next",
        arguments: {
          locale: "zh-cn",
          originCampusId: DEV_SEED.bus.originCampusId,
          destinationCampusId: DEV_SEED.bus.destinationCampusId,
        },
      });
      const nextBusesPayload = parseTextContent(nextBusesResult) as {
        totalRoutes?: number;
        departures?: Array<{
          routeId?: number;
          departureTime?: string | null;
          originCampus?: unknown;
          destinationCampus?: unknown;
        }>;
        message?: string | null;
        nextAvailableDeparture?: {
          routeId?: number;
          departureTime?: string | null;
        } | null;
      };
      expect(nextBusesPayload.totalRoutes).toBeGreaterThan(0);
      if ((nextBusesPayload.departures?.length ?? 0) > 0) {
        expect(
          nextBusesPayload.departures?.every(
            (departure) =>
              typeof departure.routeId === "number" &&
              typeof departure.departureTime === "string" &&
              !Object.hasOwn(departure, "originCampus") &&
              !Object.hasOwn(departure, "destinationCampus"),
          ),
        ).toBe(true);
      } else {
        expect(typeof nextBusesPayload.message).toBe("string");
        if (nextBusesPayload.nextAvailableDeparture) {
          expect(typeof nextBusesPayload.nextAvailableDeparture.routeId).toBe(
            "number",
          );
        }
      }

      // catalog_bus_route_get — invalid route returns error message
      const invalidTimetableResult = await mcpClient.callTool({
        name: "catalog_bus_route_get",
        arguments: { routeId: 99999, locale: "zh-cn" },
      });
      const invalidPayload = parseTextContent(invalidTimetableResult) as {
        hasData?: boolean;
        message?: string;
      };
      expect(invalidPayload.hasData).toBe(false);
    } finally {
      await closeSeededMcpSession(page, session);
    }
  });
});
