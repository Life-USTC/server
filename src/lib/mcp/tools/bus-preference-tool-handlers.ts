import {
  getBusPreference,
  saveBusPreference,
} from "@/features/bus/server/bus-service";
import {
  getUserId,
  jsonToolResult,
  resolveMcpMode,
} from "@/lib/mcp/tools/_helpers";
import type { McpModeInput, ToolExtra } from "./bus-tool-types";

type BusPreferenceToolInput = {
  preferredOriginCampusId?: number | null;
  preferredDestinationCampusId?: number | null;
  showDepartedTrips: boolean;
  mode?: McpModeInput;
};

type BusPreferenceToolPayload = {
  preferredOriginCampusId: number | null;
  preferredDestinationCampusId: number | null;
  showDepartedTrips: boolean;
};

function busPreferencePayload(
  preference: BusPreferenceToolPayload,
): BusPreferenceToolPayload {
  return {
    preferredOriginCampusId: preference.preferredOriginCampusId,
    preferredDestinationCampusId: preference.preferredDestinationCampusId,
    showDepartedTrips: preference.showDepartedTrips,
  };
}

export async function getMyBusPreferencesTool(
  { mode }: { mode?: McpModeInput },
  extra: ToolExtra,
) {
  const userId = getUserId(extra.authInfo);
  const preference = await getBusPreference(userId);

  return jsonToolResult(
    {
      preference: preference ? busPreferencePayload(preference) : null,
    },
    { mode: resolveMcpMode(mode) },
  );
}

export async function saveMyBusPreferencesTool(
  {
    preferredOriginCampusId,
    preferredDestinationCampusId,
    showDepartedTrips,
    mode,
  }: BusPreferenceToolInput,
  extra: ToolExtra,
) {
  const resolvedMode = resolveMcpMode(mode);
  const userId = getUserId(extra.authInfo);
  const result = await saveBusPreference(userId, {
    preferredOriginCampusId: preferredOriginCampusId ?? null,
    preferredDestinationCampusId: preferredDestinationCampusId ?? null,
    showDepartedTrips,
  });

  if (!result.ok) {
    return jsonToolResult(
      {
        success: false,
        error: "invalid_bus_preference",
        message: result.error,
        hint: "Use list_bus_routes to find valid campus IDs before saving preferences.",
      },
      { mode: resolvedMode },
    );
  }

  return jsonToolResult(
    {
      preference: busPreferencePayload(result.preference),
    },
    { mode: resolvedMode },
  );
}
