<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import type { DashboardSubscriptionsTabCopy } from "./subscription-tab-types";

export let calendarSubscriptionUrl: string | null;
export let copyCalendarLink: (event: MouseEvent) => void | Promise<void>;
export let openBulkImportDialog: () => void;
export let subscriptionsCopy: DashboardSubscriptionsTabCopy;
</script>

<div class="flex flex-wrap items-center gap-2 md:justify-end">
  <Button class="min-w-28" size="lg" type="button" onclick={openBulkImportDialog}>
    {subscriptionsCopy.bulkImport.title}
  </Button>
  {#if calendarSubscriptionUrl}
    <Button
      class="min-w-28"
      data-copy-url={calendarSubscriptionUrl}
      onclick={copyCalendarLink}
      size="lg"
      type="button"
      variant="outline"
    >
      {subscriptionsCopy.iCalLink}
    </Button>
  {/if}
</div>
