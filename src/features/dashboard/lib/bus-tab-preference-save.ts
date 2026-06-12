import { saveBusPlannerPreference as saveBusPlannerPreferenceRequest } from "@/features/dashboard/lib/bus";
import type { DashboardBusCopy } from "./bus-tab-types";

export function createBusPlannerPreferenceSave(input: {
  getBusCopy: () => DashboardBusCopy;
  getBusEndCampusId: () => number | null;
  getBusPreferenceSaveRun: () => number;
  getBusPreferenceSaveTimer: () => ReturnType<typeof setTimeout> | null;
  getBusShowDepartedTrips: () => boolean;
  getBusStartCampusId: () => number | null;
  getSavePreferences: () => boolean;
  setBusPreferenceSaveRun: (value: number) => void;
  setBusPreferenceSaveTimer: (
    value: ReturnType<typeof setTimeout> | null,
  ) => void;
}) {
  async function saveBusPlannerPreference() {
    if (!input.getSavePreferences()) return;
    const runId = input.getBusPreferenceSaveRun() + 1;
    input.setBusPreferenceSaveRun(runId);
    try {
      await saveBusPlannerPreferenceRequest({
        preferredDestinationCampusId: input.getBusEndCampusId(),
        preferredOriginCampusId: input.getBusStartCampusId(),
        saveFailedMessage: input.getBusCopy().preferences.saveFailed,
        showDepartedTrips: input.getBusShowDepartedTrips(),
      });
    } catch (error) {
      if (runId === input.getBusPreferenceSaveRun()) {
        console.error(
          error instanceof Error
            ? error.message
            : input.getBusCopy().preferences.saveFailed,
        );
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
