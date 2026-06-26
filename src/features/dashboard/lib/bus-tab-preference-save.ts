import { saveBusPlannerPreference as saveBusPlannerPreferenceRequest } from "@/features/dashboard/lib/bus";
import type { BusPreferenceSaveState } from "./bus-preferences";
import type { DashboardBusCopy } from "./bus-tab-types";

export function createBusPlannerPreferenceSave(input: {
  getBusCopy: () => DashboardBusCopy;
  getBusEndCampusId: () => number | null;
  getBusPreferenceSaveRun: () => number;
  getBusPreferenceSaveTimer: () => ReturnType<typeof setTimeout> | null;
  getBusShowDepartedTrips: () => boolean;
  getBusStartCampusId: () => number | null;
  getSavePreferences: () => boolean;
  setBusPreferenceSaveError: (value: string) => void;
  setBusPreferenceSaveRun: (value: number) => void;
  setBusPreferenceSaveState: (value: BusPreferenceSaveState) => void;
  setBusPreferenceSaveTimer: (
    value: ReturnType<typeof setTimeout> | null,
  ) => void;
}) {
  async function saveBusPlannerPreference() {
    if (!input.getSavePreferences()) return;
    const runId = input.getBusPreferenceSaveRun() + 1;
    input.setBusPreferenceSaveRun(runId);
    input.setBusPreferenceSaveError("");
    input.setBusPreferenceSaveState("saving");
    try {
      await saveBusPlannerPreferenceRequest({
        preferredDestinationCampusId: input.getBusEndCampusId(),
        preferredOriginCampusId: input.getBusStartCampusId(),
        saveFailedMessage: input.getBusCopy().preferences.saveFailed,
        showDepartedTrips: input.getBusShowDepartedTrips(),
      });
      if (runId === input.getBusPreferenceSaveRun()) {
        input.setBusPreferenceSaveState("saved");
      }
    } catch (error) {
      if (runId === input.getBusPreferenceSaveRun()) {
        input.setBusPreferenceSaveError(
          error instanceof Error
            ? error.message
            : input.getBusCopy().preferences.saveFailed,
        );
        input.setBusPreferenceSaveState("error");
      }
    }
  }

  function scheduleBusPlannerPreferenceSave() {
    if (!input.getSavePreferences()) return;
    const timer = input.getBusPreferenceSaveTimer();
    if (timer) {
      clearTimeout(timer);
    }
    input.setBusPreferenceSaveTimer(
      setTimeout(() => {
        input.setBusPreferenceSaveTimer(null);
        void saveBusPlannerPreference();
      }, 600),
    );
  }

  return { scheduleBusPlannerPreferenceSave };
}
