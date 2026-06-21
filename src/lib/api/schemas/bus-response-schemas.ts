import * as z from "zod";
import { busCampusSchema } from "./misc-response-schema-core";
import { dateTimeSchema } from "./response-schema-primitives";

const busCampusSummarySchema = busCampusSchema.extend({
  namePrimary: z.string(),
  nameSecondary: z.string().nullable(),
});

const busTripStopTimeSummarySchema = z.object({
  stopOrder: z.number().int(),
  campusId: z.number().int(),
  campusName: z.string(),
  time: z.string().nullable(),
  minutesSinceMidnight: z.number().int().nullable(),
  isPassThrough: z.boolean(),
});

const busRouteSummarySchema = z.object({
  id: z.number().int(),
  nameCn: z.string(),
  nameEn: z.string().nullable(),
  descriptionPrimary: z.string(),
  descriptionSecondary: z.string().nullable(),
  stops: z.array(
    z.object({
      stopOrder: z.number().int(),
      campus: busCampusSummarySchema,
    }),
  ),
});

const busRouteCoreSchema = busRouteSummarySchema.pick({
  id: true,
  nameCn: true,
  nameEn: true,
  descriptionPrimary: true,
  descriptionSecondary: true,
});

const busTripSummarySchema = z.object({
  id: z.number().int(),
  routeId: z.number().int(),
  dayType: z.enum(["weekday", "weekend"]),
  position: z.number().int(),
  stopTimes: z.array(busTripStopTimeSummarySchema),
  departureTime: z.string().nullable(),
  departureMinutes: z.number().int().nullable(),
  arrivalTime: z.string().nullable(),
  arrivalMinutes: z.number().int().nullable(),
});

export const busQueryResponseSchema = z.object({
  locale: z.enum(["zh-cn", "en-us"]),
  fetchedAt: dateTimeSchema,
  version: z
    .object({
      id: z.number().int(),
      key: z.string(),
      title: z.string(),
      effectiveFrom: dateTimeSchema.nullable(),
      effectiveUntil: dateTimeSchema.nullable(),
      importedAt: dateTimeSchema,
      notice: z
        .object({
          message: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  availableVersions: z.array(
    z.object({
      id: z.number().int(),
      key: z.string(),
      title: z.string(),
      effectiveFrom: dateTimeSchema.nullable(),
      effectiveUntil: dateTimeSchema.nullable(),
      importedAt: dateTimeSchema,
      notice: z
        .object({
          message: z.string().nullable(),
          url: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
  campuses: z.array(busCampusSummarySchema),
  routes: z.array(busRouteSummarySchema),
  trips: z.array(busTripSummarySchema),
  preferences: z
    .object({
      preferredOriginCampusId: z.number().int().nullable(),
      preferredDestinationCampusId: z.number().int().nullable(),
      showDepartedTrips: z.boolean(),
    })
    .nullable(),
  notice: z
    .object({
      message: z.string().nullable(),
      url: z.string().nullable(),
    })
    .nullable(),
});

export const busPreferenceResponseSchema = z.object({
  preference: z.object({
    preferredOriginCampusId: z.number().int().nullable(),
    preferredDestinationCampusId: z.number().int().nullable(),
    showDepartedTrips: z.boolean(),
  }),
});

export const busRouteSearchResponseSchema = z.object({
  originCampus: busCampusSummarySchema.nullable(),
  destinationCampus: busCampusSummarySchema.nullable(),
  total: z.number().int().nonnegative(),
  routes: z.array(
    busRouteCoreSchema.extend({
      originCampus: busCampusSummarySchema.nullable(),
      destinationCampus: busCampusSummarySchema.nullable(),
      stopCount: z.number().int().nonnegative(),
      weekdayTrips: z.number().int().nonnegative(),
      weekendTrips: z.number().int().nonnegative(),
      stops: z.array(
        z.object({
          stopOrder: z.number().int(),
          campus: busCampusSummarySchema,
        }),
      ),
    }),
  ),
});

const busNextDepartureSchema = z.object({
  tripId: z.number().int(),
  routeId: z.number().int(),
  route: busRouteCoreSchema,
  originCampus: busCampusSummarySchema.nullable(),
  destinationCampus: busCampusSummarySchema.nullable(),
  departureTime: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureEstimated: z.boolean(),
  arrivalEstimated: z.boolean(),
  minutesUntilDeparture: z.number().int().nullable(),
  dayType: z.enum(["weekday", "weekend"]),
  status: z.enum(["upcoming", "departed"]),
});

export const busNextDeparturesResponseSchema = z.object({
  originCampus: busCampusSummarySchema.nullable(),
  destinationCampus: busCampusSummarySchema.nullable(),
  atTime: dateTimeSchema,
  dayType: z.enum(["weekday", "weekend"]),
  totalRoutes: z.number().int().nonnegative(),
  departures: z.array(busNextDepartureSchema),
  nextAvailableDeparture: busNextDepartureSchema.nullable(),
  message: z.string().nullable(),
});
