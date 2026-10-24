<script lang="ts">
import BookPlus from "@lucide/svelte/icons/book-plus";
import ClipboardList from "@lucide/svelte/icons/clipboard-list";
import Link2 from "@lucide/svelte/icons/link-2";
import { Button } from "#lib/components/ui/button/index.js";
import PersonalCalendarLinkButton from "./PersonalCalendarLinkButton.svelte";
import type {
  WorkspaceSubscriptionsTabCopy,
  WorkspaceSubscriptionsTabProps,
} from "./subscription-tab-types";

export let calendarSubscriptionUrl: string | null;
export let openBulkImportDialog: () => void;
export let openQuickAddDialog: () => void;
export let sectionCopy: WorkspaceSubscriptionsTabProps["sectionCopy"];
export let subscriptionsCopy: WorkspaceSubscriptionsTabCopy;
export let readOnlyReason: string | undefined = undefined;
</script>

<div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
  <Button class="w-full sm:w-auto" type="button" disabled={Boolean(readOnlyReason)} title={readOnlyReason} onclick={openQuickAddDialog}>
    <BookPlus data-icon="inline-start" />
    {subscriptionsCopy.quickAdd.title}
  </Button>
  <Button
    class="w-full sm:w-auto"
    type="button"
    variant="outline"
    disabled={Boolean(readOnlyReason)}
    title={readOnlyReason}
    onclick={openBulkImportDialog}
  >
    <ClipboardList data-icon="inline-start" />
    {subscriptionsCopy.bulkImport.title}
  </Button>
  {#if readOnlyReason}
    <Button class="w-full sm:w-auto" type="button" variant="outline" disabled title={readOnlyReason}>
      <Link2 data-icon="inline-start" />
      {subscriptionsCopy.iCalLink}
    </Button>
  {:else if calendarSubscriptionUrl}
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
