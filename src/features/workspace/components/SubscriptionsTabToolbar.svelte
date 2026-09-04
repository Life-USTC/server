<script lang="ts">
import BookPlus from "@lucide/svelte/icons/book-plus";
import ClipboardList from "@lucide/svelte/icons/clipboard-list";
import { Button } from "$lib/components/ui/button/index.js";
import PersonalCalendarLinkButton from "./PersonalCalendarLinkButton.svelte";
import type {
  DashboardSubscriptionsTabCopy,
  DashboardSubscriptionsTabProps,
} from "./subscription-tab-types";

export let calendarSubscriptionUrl: string | null;
export let openBulkImportDialog: () => void;
export let openQuickAddDialog: () => void;
export let sectionCopy: DashboardSubscriptionsTabProps["sectionCopy"];
export let subscriptionsCopy: DashboardSubscriptionsTabCopy;
</script>

<div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
  <Button class="w-full sm:w-auto" type="button" onclick={openQuickAddDialog}>
    <BookPlus data-icon="inline-start" />
    {subscriptionsCopy.quickAdd.title}
  </Button>
  <Button
    class="w-full sm:w-auto"
    type="button"
    variant="outline"
    onclick={openBulkImportDialog}
  >
    <ClipboardList data-icon="inline-start" />
    {subscriptionsCopy.bulkImport.title}
  </Button>
  {#if calendarSubscriptionUrl}
    <PersonalCalendarLinkButton
      buttonLabel={subscriptionsCopy.iCalLink}
      className="w-full sm:w-auto"
      failureMessage={subscriptionsCopy.optOutRetry}
      {sectionCopy}
      showIcon={true}
      showSubscriptionsLink={false}
      subscriptionCalendarUrl={calendarSubscriptionUrl}
    />
  {/if}
</div>
