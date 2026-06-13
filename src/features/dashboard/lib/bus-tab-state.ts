import { getApplicableBusRoutes } from "@/features/bus/lib/bus-client";
import {
  type BusDayType,
  createBusTabPlannerController,
} from "@/features/dashboard/lib/bus-tab-planner-controller";
import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";

export function createBusTabState({
  getBus,
  getBusCopy,
  getSavePreferences,
  invalidate,
}: {
  getBus: () => DashboardBusData | null;
  getBusCopy: () => DashboardBusCopy;
  getSavePreferences: () => boolean;
  invalidate: () => void;
}) {
  const values = {
    busDayType: "weekday" as BusDayType,
    busEndCampusId: null as number | null,
    busNow: new Date(),
    busPlannerReady: false,
    busPreferenceSaveRun: 0,
    busPreferenceSaveTimer: null as ReturnType<typeof setTimeout> | null,
    busShowDepartedTrips: false,
    busStartCampusId: null as number | null,
  };

  const planner = createBusTabPlannerController({
    getBus,
    getBusCopy,
    getBusDayType: () => values.busDayType,
    getBusEndCampusId: () => values.busEndCampusId,
    getBusPreferenceSaveRun: () => values.busPreferenceSaveRun,
    getBusPreferenceSaveTimer: () => values.busPreferenceSaveTimer,
    getBusShowDepartedTrips: () => values.busShowDepartedTrips,
    getBusStartCampusId: () => values.busStartCampusId,
    getSavePreferences,
    setBusDayType: (value) => {
      values.busDayType = value;
      invalidate();
    },
    setBusEndCampusId: (value) => {
      values.busEndCampusId = value;
      invalidate();
    },
    setBusNow: (value) => {
      values.busNow = value;
      invalidate();
    },
    setBusPlannerReady: (value) => {
      values.busPlannerReady = value;
      invalidate();
    },
    setBusPreferenceSaveRun: (value) => {
      values.busPreferenceSaveRun = value;
      invalidate();
    },
    setBusPreferenceSaveTimer: (value) => {
      values.busPreferenceSaveTimer = value;
      invalidate();
    },
    setBusShowDepartedTrips: (value) => {
      values.busShowDepartedTrips = value;
      invalidate();
    },
    setBusStartCampusId: (value) => {
      values.busStartCampusId = value;
      invalidate();
    },
  });

  return {
    actions: planner,
    applicableRoutes: () => {
      const bus = getBus();
      if (!bus) return [];
      return getApplicableBusRoutes({
        data: bus,
        dayType: values.busDayType,
        startCampusId: values.busStartCampusId,
        endCampusId: values.busEndCampusId,
        showDepartedTrips: values.busShowDepartedTrips,
        now: values.busNow,
      });
    },
    initializeWhenNeeded: () => {
      if (
        getBus() &&
        values.busStartCampusId == null &&
        values.busEndCampusId == null
      ) {
        planner.initializeBusPlanner();
      }
    },
    values,
  };
}
