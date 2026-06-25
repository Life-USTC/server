import { apiClient } from "@/lib/api/client";

export type BusPreferenceSaveState = "idle" | "saving" | "saved" | "error";

export function busPreferenceStatusText({
  autosaveHint,
  error,
  saveFailed,
  saved,
  saving,
  state,
}: {
  autosaveHint: string;
  error: string;
  saveFailed: string;
  saved: string;
  saving: string;
  state: BusPreferenceSaveState;
}) {
  if (state === "saving") return saving;
  if (state === "saved") return saved;
  if (state === "error") return error || saveFailed;
  return autosaveHint;
}

export async function saveBusPlannerPreference(input: {
  preferredDestinationCampusId: number | null;
  preferredOriginCampusId: number | null;
  saveFailedMessage: string;
  showDepartedTrips: boolean;
}) {
  const result = await apiClient.POST("/api/bus/preferences", {
    body: {
      preferredDestinationCampusId: input.preferredDestinationCampusId,
      preferredOriginCampusId: input.preferredOriginCampusId,
      showDepartedTrips: input.showDepartedTrips,
    },
  });
  if (!result.response.ok) {
    throw new Error(input.saveFailedMessage);
  }
}
