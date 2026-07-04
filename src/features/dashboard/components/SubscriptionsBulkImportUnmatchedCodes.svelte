<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
} from "./subscription-tab-types";

export let formatMessage: FormatMessage;
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let unmatchedSectionCodes: string[];
</script>

{#if unmatchedSectionCodes.length > 0}
  <Alert.Root>
    <Alert.Title>
      {formatMessage(subscriptionsCopy.bulkImport.unmatchedCodes, {
        count: unmatchedSectionCodes.length,
      })}
    </Alert.Title>
    <Alert.Description>
      {unmatchedSectionCodes.join(", ")}
    </Alert.Description>
  </Alert.Root>
{/if}
