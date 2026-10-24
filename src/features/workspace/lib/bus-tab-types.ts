import type { BusTimetableData } from "@/features/bus/lib/bus-timetable-types";
import type { TableFilterLabels } from "@/lib/table-filters";

export type WorkspaceBusData = Pick<
  BusTimetableData,
  | "campuses"
  | "fetchedAt"
  | "notice"
  | "preferences"
  | "routes"
  | "trips"
  | "version"
>;

export type WorkspaceBusCopy = Record<string, unknown> & {
  applyFilters: string;
  clear: string;
  tableFilters: TableFilterLabels;
  passThrough: string;
  route: { stops: string };
  arriveAt: string;
  changeRoute: string;
  workspaceTitle: string;
  dayType: {
    weekday: string;
    saturday: string;
    sunday: string;
  };
  empty: string;
  loadFailed: string;
  fullTimetable: string;
  hideFullTimetable: string;
  hideRouteControls: string;
  nextDeparture: string;
  noMoreBusToday: string;
  planner: {
    routes: string;
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
  retry: string;
  upcomingTrips: string;
};
