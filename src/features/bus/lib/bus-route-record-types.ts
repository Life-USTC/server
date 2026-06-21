import type { BusRouteStopSummary } from "./bus-types";

export type RouteRecord = {
  id: number;
  nameCn: string;
  nameEn: string | null;
  stops: BusRouteStopSummary[];
};
