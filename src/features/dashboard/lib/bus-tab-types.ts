import type { BusTimetableData } from "@/features/bus/lib/bus-timetable-types";

export type DashboardBusData = Pick<
  BusTimetableData,
  "campuses" | "notice" | "preferences" | "routes" | "trips" | "version"
>;

export type DashboardBusCopy = Record<string, unknown> & {
  activeVersion: string;
  dashboardTitle: string;
  dayType: {
    weekday: string;
    weekend: string;
  };
  empty: string;
  planner: {
    empty: string;
    emptyReverseAction: string;
    end: string;
    estimatedHint: string;
    reverse: string;
    start: string;
  };
  preferences: {
    saveFailed: string;
  };
  query: {
    dayType: string;
    showDepartedTrips: string;
  };
  transitMap: string;
};
