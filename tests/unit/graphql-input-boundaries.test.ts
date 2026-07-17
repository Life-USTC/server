import { Kind } from "graphql";
import { describe, expect, it, vi } from "vitest";
import {
  capGraphqlAlternateRoutes,
  capGraphqlBusCampuses,
  capGraphqlBusRoute,
  capGraphqlBusTripSlots,
} from "@/lib/graphql/bus-output";
import { GRAPHQL_LIMITS } from "@/lib/graphql/constants";
import {
  graphqlDateScalar,
  graphqlDateTimeScalar,
} from "@/lib/graphql/date-scalar";
import {
  requireGraphqlId,
  validateGraphqlIdList,
  validateGraphqlSearch,
  validateGraphqlTeacherCode,
  validateGraphqlVersionKey,
} from "@/lib/graphql/input-boundaries";
import { normalizeGraphqlPage } from "@/lib/graphql/pagination";
import { createDeadline } from "@/lib/graphql/request-deadline";

describe("GraphQL protocol input boundaries", () => {
  it("keeps pagination defaults and rejects oversized pages", () => {
    expect(normalizeGraphqlPage()).toEqual({ page: 1, pageSize: 20 });
    expect(() =>
      normalizeGraphqlPage({ page: GRAPHQL_LIMITS.page + 1 }),
    ).toThrow("page must be between");
    expect(() =>
      normalizeGraphqlPage({ pageSize: GRAPHQL_LIMITS.pageSize + 1 }),
    ).toThrow("pageSize must be between");
  });

  it("bounds identifier arrays and requires positive identifiers", () => {
    expect(validateGraphqlIdList([1, 2], "ids")).toEqual([1, 2]);
    expect(() =>
      validateGraphqlIdList(
        Array.from(
          { length: GRAPHQL_LIMITS.idList + 1 },
          (_, index) => index + 1,
        ),
        "ids",
      ),
    ).toThrow("ids must contain at most");
    expect(() => validateGraphqlIdList([0], "ids")).toThrow(
      "ids must contain positive integers",
    );
    expect(() => requireGraphqlId(-1, "routeId")).toThrow(
      "routeId must be a positive integer",
    );
  });

  it("bounds free text and validates bus selectors", () => {
    expect(validateGraphqlSearch("linear algebra")).toBe("linear algebra");
    expect(() =>
      validateGraphqlSearch("x".repeat(GRAPHQL_LIMITS.searchChars + 1)),
    ).toThrow("search must not exceed");
    expect(() =>
      validateGraphqlTeacherCode(
        "x".repeat(GRAPHQL_LIMITS.teacherCodeChars + 1),
      ),
    ).toThrow("teacherCode must not exceed");
    expect(validateGraphqlVersionKey("static-bus-structured")).toBe(
      "static-bus-structured",
    );
    expect(() => validateGraphqlVersionKey("../unsafe")).toThrow(
      "versionKey has an invalid format",
    );
  });

  it("keeps Date output-only for variables and literals", () => {
    expect(graphqlDateScalar.serialize(new Date("2026-04-29T00:00:00Z"))).toBe(
      "2026-04-29",
    );
    expect(() => graphqlDateScalar.parseValue("2026-04-29")).toThrow(
      "Date is output-only",
    );
    expect(() =>
      graphqlDateScalar.parseLiteral(
        { kind: Kind.STRING, value: "2026-04-29" },
        undefined,
      ),
    ).toThrow("Date is output-only");
  });

  it.each([
    "2026-04-29T08:00:00+08:00",
    "2026-04-29T00:00:00Z",
    "2024-02-29T23:59:59.123-05:30",
  ])("accepts the zoned DateTime %s for variables and literals", (value) => {
    expect(graphqlDateTimeScalar.parseValue(value)).toBe(value);
    expect(
      graphqlDateTimeScalar.parseLiteral(
        { kind: Kind.STRING, value },
        undefined,
      ),
    ).toBe(value);
  });

  it.each([
    "2026-04-29T08:00:00",
    "2026-02-29T08:00:00Z",
    "2026-04-31T08:00:00+08:00",
    "2026-04-29T24:00:00+08:00",
    "2026-04-29T08:00:00+14:01",
  ])("rejects the invalid zoned DateTime %s", (value) => {
    expect(() => graphqlDateTimeScalar.parseValue(value)).toThrow(
      "DateTime must be an ISO 8601 datetime with a timezone",
    );
    expect(() =>
      graphqlDateTimeScalar.parseLiteral(
        { kind: Kind.STRING, value },
        undefined,
      ),
    ).toThrow("DateTime must be an ISO 8601 datetime with a timezone");
  });

  it("rejects non-string DateTime variables and literals", () => {
    expect(() => graphqlDateTimeScalar.parseValue(1)).toThrow(
      "DateTime must be an ISO 8601 datetime with a timezone",
    );
    expect(() =>
      graphqlDateTimeScalar.parseLiteral(
        { kind: Kind.INT, value: "1" },
        undefined,
      ),
    ).toThrow("DateTime must be an ISO 8601 datetime with a timezone");
  });

  it("caps every fixed-size bus collection", () => {
    const route = {
      id: 1,
      nameCn: "东区到西区",
      nameEn: null,
      descriptionPrimary: "东区到西区",
      stops: Array.from(
        { length: GRAPHQL_LIMITS.busRouteStops + 1 },
        (_, stopOrder) => ({
          stopOrder,
          campusId: stopOrder + 1,
          campusName: String(stopOrder),
        }),
      ),
    };
    const campuses = Array.from(
      { length: GRAPHQL_LIMITS.busCampuses + 1 },
      (_, id) => ({
        id,
        nameCn: String(id),
        nameEn: null,
        namePrimary: String(id),
        nameSecondary: null,
        latitude: 0,
        longitude: 0,
      }),
    );
    const stopTimes = Array.from(
      { length: GRAPHQL_LIMITS.busStopTimes + 1 },
      (_, stopOrder) => ({ stopOrder, time: null }),
    );
    const alternateRoutes = Array.from(
      { length: GRAPHQL_LIMITS.busAlternateRoutes + 1 },
      (_, id) => ({ ...route, id }),
    );

    expect(capGraphqlBusRoute(route).stops).toHaveLength(
      GRAPHQL_LIMITS.busRouteStops,
    );
    expect(capGraphqlBusCampuses(campuses)).toHaveLength(
      GRAPHQL_LIMITS.busCampuses,
    );
    expect(
      capGraphqlBusTripSlots([{ position: 1, stopTimes }])[0]?.stopTimes,
    ).toHaveLength(GRAPHQL_LIMITS.busStopTimes);
    expect(capGraphqlAlternateRoutes(alternateRoutes)).toHaveLength(
      GRAPHQL_LIMITS.busAlternateRoutes,
    );
  });

  it("aborts the request signal at the configured deadline", async () => {
    vi.useFakeTimers();
    const deadline = createDeadline(new AbortController().signal, 25);

    await vi.advanceTimersByTimeAsync(25);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.timedOut()).toBe(true);
    deadline.cleanup();
    vi.useRealTimers();
  });
});
