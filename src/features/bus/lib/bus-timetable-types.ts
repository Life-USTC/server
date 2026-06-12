import type { BusScheduleDayType } from "@/generated/prisma/client";

export type BusLocale = "zh-cn" | "en-us";
export type BusResolvedDayType = BusScheduleDayType | "auto";
export type BusTripStatus = "upcoming" | "departed";

export type BusCampusSummary = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  namePrimary: string;
  nameSecondary: string | null;
  latitude: number;
  longitude: number;
};

export type BusRouteStopSummary = {
  stopOrder: number;
  campus: BusCampusSummary;
};

export type BusRouteSummary = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  descriptionPrimary: string;
  descriptionSecondary: string | null;
  stops: BusRouteStopSummary[];
};

export type BusTripStopTime = {
  stopOrder: number;
  campusId: number;
  campusName: string;
  time: string | null;
  minutesSinceMidnight: number | null;
  isPassThrough: boolean;
};

export type BusTripSummary = {
  id: number;
  routeId: number;
  dayType: BusScheduleDayType;
  position: number;
  stopTimes: BusTripStopTime[];
  departureTime: string | null;
  departureMinutes: number | null;
  arrivalTime: string | null;
  arrivalMinutes: number | null;
};

export type BusNotice = {
  message: string | null;
  url: string | null;
};

export type BusScheduleVersionSummary = {
  id: number;
  key: string;
  title: string;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  importedAt: string;
  notice: BusNotice | null;
};

export type BusUserPreferenceSummary = {
  preferredOriginCampusId: number | null;
  preferredDestinationCampusId: number | null;
  showDepartedTrips: boolean;
};

export type BusPreferencePayload = BusUserPreferenceSummary;

export type BusTimetableInput = {
  locale: BusLocale;
  now?: string;
  versionKey?: string | null;
  userId?: string | null;
};

export type BusTimetableData = {
  locale: BusLocale;
  fetchedAt: string;
  version: BusScheduleVersionSummary | null;
  availableVersions: BusScheduleVersionSummary[];
  campuses: BusCampusSummary[];
  routes: BusRouteSummary[];
  trips: BusTripSummary[];
  preferences: BusUserPreferenceSummary | null;
  notice: BusNotice | null;
};

export type BusDashboardSnapshot = {
  data: BusTimetableData;
};
