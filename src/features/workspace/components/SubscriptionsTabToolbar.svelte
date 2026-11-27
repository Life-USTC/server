<script lang="ts">
import BookPlus from "@lucide/svelte/icons/book-plus";
import ClipboardList from "@lucide/svelte/icons/clipboard-list";
import Link2 from "@lucide/svelte/icons/link-2";
import { onMount, tick } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import { page } from "$app/state";
import PersonalCalendarLinkButton from "./PersonalCalendarLinkButton.svelte";
import type { WorkspaceSubscriptionsTabProps } from "./subscription-tab-types";

export let calendarLinkState:
  | "ready"
  | "reauthenticate"
  | "unavailable"
  | undefined = undefined;
export let calendarSubscriptionUrl: string | null;
export let showSubscriptionActions = true;
export let openBulkImportDialog: () => void;
export let openQuickAddDialog: () => void;
export let sectionCopy: WorkspaceSubscriptionsTabProps["sectionCopy"];
export let subscriptionsCopy: WorkspaceSubscriptionsTabProps["subscriptionsCopy"];
export let readOnlyReason: string | undefined = undefined;
let calendarLink: PersonalCalendarLinkButton;
onMount(async () => {
  if (page.url.searchParams.get("calendarLink") === "1") {
    await tick();
    calendarLink?.open();
  }
});
</script>

<div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
  {#if showSubscriptionActions}
  <Button icon={BookPlus} class="w-full sm:w-auto" disabled={Boolean(readOnlyReason)} title={readOnlyReason} onclick={openQuickAddDialog}>
    {subscriptionsCopy.quickAdd.title}
  </Button>
  <Button
    icon={ClipboardList}
    class="w-full sm:w-auto"
    variant="outline"
    disabled={Boolean(readOnlyReason)}
    title={readOnlyReason}
    onclick={openBulkImportDialog}
  >
    {subscriptionsCopy.bulkImport.title}
  </Button>
  {/if}
  {#if readOnlyReason}
    <Button icon={Link2} class="w-full sm:w-auto" variant="outline" disabled title={readOnlyReason}>
      {subscriptionsCopy.iCalLink}
    </Button>
  {:else}
    <PersonalCalendarLinkButton bind:this={calendarLink}
      buttonLabel={subscriptionsCopy.iCalLink}
      className="w-full sm:w-auto"
      failureMessage={subscriptionsCopy.optOutRetry}
      {sectionCopy}
      showIcon={true}
      showSubscriptionsLink={false}
      subscriptionCalendarUrl={calendarSubscriptionUrl ?? ""}
      {calendarLinkState}
    />
  {/if}
</div>
