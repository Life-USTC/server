import type { BusPreferencePayload } from "@/features/bus/lib/bus-types";
import { saveBusPreference } from "@/features/bus/server/bus-service";
import type { GraphqlContext } from "../context";
import { requireGraphqlId } from "../input-boundaries";
import { badMutationInput } from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";

export const busMutationResolvers = {
  async busPreferencesSet(
    _parent: unknown,
    args: { input: BusPreferencePayload },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.bus-preferences",
    );
    const input = args.input;
    const result = await saveBusPreference(principal.userId, {
      preferredOriginCampusId:
        input.preferredOriginCampusId == null
          ? null
          : requireGraphqlId(
              input.preferredOriginCampusId,
              "preferredOriginCampusId",
            ),
      preferredDestinationCampusId:
        input.preferredDestinationCampusId == null
          ? null
          : requireGraphqlId(
              input.preferredDestinationCampusId,
              "preferredDestinationCampusId",
            ),
      showDepartedTrips: input.showDepartedTrips,
    });
    if (!result.ok) badMutationInput(result.error);
    return result.preference;
  },
};
