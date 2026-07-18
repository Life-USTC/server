import type { BusTimetableData } from "@/features/bus/lib/bus-timetable-types";

export type DashboardBusData = Pick<
  BusTimetableData,
  | "campuses"
  | "fetchedAt"
  | "notice"
  | "preferences"
  | "routes"
  | "trips"
  | "version"
>;

export type DashboardBusCopy = Record<string, unknown> & {
  arriveAt: string;
  changeRoute: string;
  dashboardTitle: string;
  dayType: {
    weekday: string;
    weekend: string;
  };
  empty: string;
  fullTimetable: string;
  hideFullTimetable: string;
  hideRouteControls: string;
  nextDeparture: string;
  noMoreBusToday: string;
  planner: {
    empty: string;
    emptyReverseAction: string;
    end: string;
    estimatedHint: string;
    reverse: string;
    start: string;
  };
  preferences: {
    autosaveHint: string;
    saveFailed: string;
    saved: string;
    saving: string;
  };
  query: {
    dayType: string;
    showDepartedTrips: string;
  };
  transitMap: string;
  upcomingTrips: string;
};
