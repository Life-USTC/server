<script lang="ts">
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
} from "./subscription-tab-types";

export let formatMessage: FormatMessage;
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let unmatchedSectionCodes: string[];
</script>

{#if unmatchedSectionCodes.length > 0}
  <div class="rounded-md border border-base-300 bg-base-200/50 p-3">
    <p class="font-medium text-sm">
      {formatMessage(subscriptionsCopy.bulkImport.unmatchedCodes, {
        count: unmatchedSectionCodes.length,
      })}
    </p>
    <p class="mt-1 text-base-content/60 text-sm">
      {unmatchedSectionCodes.join(", ")}
    </p>
  </div>
{/if}
