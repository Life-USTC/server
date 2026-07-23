<script lang="ts">
import BookPlus from "@lucide/svelte/icons/book-plus";
import ClipboardList from "@lucide/svelte/icons/clipboard-list";
import Link2 from "@lucide/svelte/icons/link-2";
import { Button } from "$lib/components/ui/button/index.js";
import type { DashboardSubscriptionsTabCopy } from "./subscription-tab-types";

export let calendarSubscriptionUrl: string | null;
export let copyCalendarLink: (event: MouseEvent) => void | Promise<void>;
export let openBulkImportDialog: () => void;
export let openQuickAddDialog: () => void;
export let subscriptionsCopy: DashboardSubscriptionsTabCopy;
</script>

<div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
  <Button class="w-full sm:w-auto" size="lg" type="button" onclick={openQuickAddDialog}>
    <BookPlus data-icon="inline-start" />
    {subscriptionsCopy.quickAdd.title}
  </Button>
  <Button
    class="w-full sm:w-auto"
    size="lg"
    type="button"
    variant="outline"
    onclick={openBulkImportDialog}
  >
    <ClipboardList data-icon="inline-start" />
    {subscriptionsCopy.bulkImport.title}
  </Button>
  {#if calendarSubscriptionUrl}
    <Button
      class="w-full sm:w-auto"
      data-copy-url={calendarSubscriptionUrl}
      onclick={copyCalendarLink}
      size="lg"
      type="button"
      variant="outline"
    >
      <Link2 data-icon="inline-start" />
      {subscriptionsCopy.iCalLink}
    </Button>
  {/if}
</div>
