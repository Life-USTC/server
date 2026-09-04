import { batchUpdateUserSectionSubscriptions } from "@/features/subscriptions/server/subscriptions";
import type { GraphqlContext } from "../context";
import { validateOptionalGraphqlId } from "../input-boundaries";
import { badMutationInput, mutationNotFound } from "../mutation-errors";
import { requireGraphqlMutation } from "../mutation-guard";
import { rejectExplicitNullFields } from "../mutation-input";
import {
  normalizeSubscriptionBatchCodes,
  setSectionSubscription,
} from "./shared";

type SectionSubscriptionBatchAction = "add" | "remove" | "set";

type UpdateSectionSubscriptionsInput = {
  action: SectionSubscriptionBatchAction;
  codes: string[];
  semesterId?: number | null;
};

export const sectionSubscriptionBatchActionResolver = {
  ADD: "add",
  REMOVE: "remove",
  SET: "set",
} as const satisfies Record<string, SectionSubscriptionBatchAction>;

export const subscriptionMutationResolvers = {
  subscriptionAdd(
    _parent: unknown,
    args: { jwId: number },
    context: GraphqlContext,
  ) {
    return setSectionSubscription(context, args.jwId, true);
  },
  subscriptionRemove(
    _parent: unknown,
    args: { jwId: number },
    context: GraphqlContext,
  ) {
    return setSectionSubscription(context, args.jwId, false);
  },
  async subscriptionsImport(
    _parent: unknown,
    args: { input: UpdateSectionSubscriptionsInput },
    context: GraphqlContext,
  ) {
    const principal = await requireGraphqlMutation(
      context,
      "workspace.subscription",
      {
        rateLimitTier: "batch",
      },
    );
    const input = args.input;
    rejectExplicitNullFields(input, ["semesterId"]);
    const codes = normalizeSubscriptionBatchCodes(input.codes);
    if (input.action !== "set" && codes.length === 0) {
      badMutationInput("codes must contain at least one item.");
    }
    const semesterId = validateOptionalGraphqlId(
      input.semesterId,
      "semesterId",
    );
    if (input.action === "set" && semesterId === undefined) {
      badMutationInput("semesterId is required when action is SET.");
    }

    const result = await batchUpdateUserSectionSubscriptions({
      action: input.action,
      codes,
      locale: context.locale,
      semesterId,
      userId: principal.userId,
    });
    if (!result) mutationNotFound("Semester not found.");
    return {
      action: result.action,
      semesterId: result.semester?.id ?? null,
      matchedCodes: result.matchedCodes,
      unmatchedCodes: result.unmatchedCodes,
      addedCount: result.addedCount,
      removedCount: result.removedCount,
      unchangedCount: result.unchangedCount,
      total: result.total,
    };
  },
};
