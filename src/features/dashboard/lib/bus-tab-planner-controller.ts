import {
  getDefaultBusSelection,
  resolveClientBusDayType,
} from "@/features/bus/lib/bus-client";
import { createBusPlannerPreferenceSave } from "./bus-tab-preference-save";
import type { DashboardBusCopy, DashboardBusData } from "./bus-tab-types";

export type BusDayType = "weekday" | "weekend";

type BusTabPlannerControllerInput = {
  getBus: () => DashboardBusData | null;
  getBusCopy: () => DashboardBusCopy;
  getBusDayType: () => BusDayType;
  getBusEndCampusId: () => number | null;
  getBusPreferenceSaveRun: () => number;
  getBusPreferenceSaveTimer: () => ReturnType<typeof setTimeout> | null;
  getBusShowDepartedTrips: () => boolean;
  getBusStartCampusId: () => number | null;
  getSavePreferences: () => boolean;
  setBusDayType: (value: BusDayType) => void;
  setBusEndCampusId: (value: number | null) => void;
  setBusNow: (value: Date) => void;
  setBusPlannerReady: (value: boolean) => void;
  setBusPreferenceSaveRun: (value: number) => void;
  setBusPreferenceSaveTimer: (
    value: ReturnType<typeof setTimeout> | null,
  ) => void;
  setBusShowDepartedTrips: (value: boolean) => void;
  setBusStartCampusId: (value: number | null) => void;
};

export function createBusTabPlannerController(
  input: BusTabPlannerControllerInput,
) {
  const { scheduleBusPlannerPreferenceSave } =
    createBusPlannerPreferenceSave(input);

  function initializeBusPlanner() {
    const bus = input.getBus();
    if (!bus) return;
    const selection = getDefaultBusSelection(bus, bus.preferences);
    input.setBusDayType(resolveClientBusDayType(new Date()));
    input.setBusStartCampusId(selection.startCampusId);
    input.setBusEndCampusId(selection.endCampusId);
    input.setBusShowDepartedTrips(bus.preferences?.showDepartedTrips ?? false);
    input.setBusNow(new Date());
  }

  function selectBusStart(campusId: number) {
    if (input.getBusEndCampusId() === campusId) {
      input.setBusEndCampusId(input.getBusStartCampusId());
    }
    input.setBusStartCampusId(campusId);
    scheduleBusPlannerPreferenceSave();
  }

  function selectBusEnd(campusId: number) {
    if (input.getBusStartCampusId() === campusId) {
      input.setBusStartCampusId(input.getBusEndCampusId());
    }
    input.setBusEndCampusId(campusId);
    scheduleBusPlannerPreferenceSave();
  }

  function reverseBusStops() {
    const nextStart = input.getBusEndCampusId();
    input.setBusEndCampusId(input.getBusStartCampusId());
    input.setBusStartCampusId(nextStart);
    scheduleBusPlannerPreferenceSave();
  }

  function setBusDayType(dayType: BusDayType) {
    input.setBusDayType(dayType);
  }

  function toggleBusDepartedTrips() {
    input.setBusShowDepartedTrips(!input.getBusShowDepartedTrips());
    scheduleBusPlannerPreferenceSave();
  }

  function mount() {
    initializeBusPlanner();
    input.setBusPlannerReady(true);
    const interval = window.setInterval(() => {
      input.setBusNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(interval);
      const timer = input.getBusPreferenceSaveTimer();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }

  return {
    initializeBusPlanner,
    mount,
    reverseBusStops,
    selectBusEnd,
    selectBusStart,
    setBusDayType,
    toggleBusDepartedTrips,
  };
}
