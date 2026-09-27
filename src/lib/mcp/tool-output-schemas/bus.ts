import { z } from "zod";
import {
  busNextDeparturesResponseSchema,
  busPreferenceResponseSchema,
  busQueryResponseSchema,
} from "@/lib/api/schemas/bus-response-schemas";
import {
  collectionOutputSchema,
  compactBusCampusSchema,
  compactCampusSchema,
  dateTimeSchema,
  type McpToolOutputSchema,
  objectOutputSchema,
} from "./shared";

const busStopSchema = z.union([
  z.strictObject({ stopOrder: z.number().int(), campus: compactCampusSchema }),
  z.strictObject({
    stopOrder: z.number().int(),
    campusId: z.number().int(),
    campusName: z.string(),
  }),
]);
const busStopTimeSchema =
  busQueryResponseSchema.shape.trips.element.shape.stopTimes.element;
const busTripSlotSchema = z.strictObject({
  position: z.number().int(),
  stopTimes: z.array(busStopTimeSchema.pick({ stopOrder: true, time: true })),
});

export const compactBusRouteSchema = z
  .strictObject({
    ...busQueryResponseSchema.shape.routes.element.shape,
    routeId: z.number().int(),
    weekdayTrips: z.number().int().nonnegative(),
    saturdayTrips: z.number().int().nonnegative(),
    sundayTrips: z.number().int().nonnegative(),
    stopCount: z.number().int().nonnegative(),
    stops: z.array(busStopSchema),
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
  })
  .partial();

export const compactBusTripSchema = z
  .strictObject({
    ...busQueryResponseSchema.shape.trips.element.shape,
    ...busNextDeparturesResponseSchema.shape.departures.element.shape,
    route: compactBusRouteSchema,
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
  })
  .partial();

export const busVersionSummarySchema = z.strictObject({
  key: z.string(),
  title: z.string(),
  effectiveFrom: dateTimeSchema.nullable(),
  effectiveUntil: dateTimeSchema.nullable(),
});

export const busCountsSchema = z.strictObject({
  campuses: z.number().int().nonnegative(),
  routes: z.number().int().nonnegative(),
  weekdayTrips: z.number().int().nonnegative(),
  saturdayTrips: z.number().int().nonnegative(),
  sundayTrips: z.number().int().nonnegative(),
});

export const compactBusRouteCoreSchema = z.strictObject({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  descriptionPrimary: z.string(),
  descriptionSecondary: z.string().nullable(),
});

export const busTimetableDefaultSchema = z.union([
  z.strictObject({
    success: z.literal(true),
    locale: z.enum(["zh-cn", "en-us"]),
    fetchedAt: dateTimeSchema,
    version: busVersionSummarySchema.nullable(),
    counts: busCountsSchema,
    campuses: z.array(compactBusCampusSchema),
    routes: z.array(compactBusRouteCoreSchema),
    preferences: busQueryResponseSchema.shape.preferences,
    nextDepartures: busNextDeparturesResponseSchema.shape.departures,
    nextDeparturesMessage: z.string().nullable(),
    notice: z.strictObject({ message: z.string() }).nullable(),
  }),
  z.strictObject({
    success: z.literal(true),
    locale: z.enum(["zh-cn", "en-us"]),
    hasData: z.literal(false),
    message: z.string(),
  }),
]);

export const busTimetableFullSchema = z.union([
  z.strictObject({
    ...busQueryResponseSchema.shape,
    success: z.literal(true),
    counts: busCountsSchema,
    nextDepartures: busNextDeparturesResponseSchema.shape.departures,
    nextDeparturesMessage: z.string().nullable(),
  }),
  z.strictObject({
    success: z.literal(true),
    locale: z.enum(["zh-cn", "en-us"]),
    hasData: z.literal(false),
    message: z.string(),
  }),
]);

export const busModeOutputSchemas = {
  catalog_bus_timetable_get: {
    default: busTimetableDefaultSchema,
    full: busTimetableFullSchema,
  },
} satisfies Record<string, Record<"default" | "full", McpToolOutputSchema>>;

export const busToolOutputSchemas: Record<string, McpToolOutputSchema> = {
  catalog_bus_timetable_get: objectOutputSchema({
    locale: z.enum(["zh-cn", "en-us"]),
    fetchedAt: dateTimeSchema,
    version: z
      .union([busVersionSummarySchema, busQueryResponseSchema.shape.version])
      .nullable(),
    counts: busCountsSchema,
    campuses: z.array(
      z.union([
        compactBusCampusSchema,
        busQueryResponseSchema.shape.campuses.element,
      ]),
    ),
    routes: z.array(
      z.union([
        compactBusRouteCoreSchema,
        busQueryResponseSchema.shape.routes.element,
      ]),
    ),
    trips: z.array(compactBusTripSchema),
    availableVersions: busQueryResponseSchema.shape.availableVersions,
    preferences: busQueryResponseSchema.shape.preferences,
    nextDepartures: busNextDeparturesResponseSchema.shape.departures,
    nextDeparturesMessage: z.string().nullable(),
    notice: z.union([
      z.strictObject({ message: z.string() }).nullable(),
      busQueryResponseSchema.shape.notice,
    ]),
    hasData: z.boolean(),
  }),
  catalog_bus_route_list: objectOutputSchema({
    locale: z.string(),
    version: busQueryResponseSchema.shape.version,
    campuses: collectionOutputSchema(compactCampusSchema),
    routes: collectionOutputSchema(compactBusRouteSchema),
    notice: busQueryResponseSchema.shape.notice,
  }),
  catalog_bus_route_get: objectOutputSchema({
    routeId: z.number().int(),
    route: compactBusRouteSchema,
    weekday: collectionOutputSchema(busTripSlotSchema),
    saturday: collectionOutputSchema(busTripSlotSchema),
    sunday: collectionOutputSchema(busTripSlotSchema),
    alternateRoutes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  workspace_bus_preferences_get: objectOutputSchema({
    preference: busPreferenceResponseSchema.shape.preference.nullable(),
  }),
  workspace_bus_preferences_set: objectOutputSchema(
    busPreferenceResponseSchema.shape,
  ),
  catalog_bus_route_search: objectOutputSchema({
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    total: z.number().int().nonnegative(),
    routes: collectionOutputSchema(compactBusRouteSchema),
    hasData: z.boolean(),
  }),
  catalog_bus_departure_next: objectOutputSchema({
    atTime: dateTimeSchema,
    dayType: z.enum(["weekday", "saturday", "sunday"]),
    totalRoutes: z.number().int().nonnegative(),
    departures: collectionOutputSchema(compactBusTripSchema),
    nextAvailableDeparture: compactBusTripSchema.nullable(),
    originCampus: compactCampusSchema.nullable(),
    destinationCampus: compactCampusSchema.nullable(),
    hasData: z.boolean(),
    message: z.string().nullable(),
  }),
};
