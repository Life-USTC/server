<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import SubscriptionsBulkImportMatchedList from "./SubscriptionsBulkImportMatchedList.svelte";
import SubscriptionsBulkImportUnmatchedCodes from "./SubscriptionsBulkImportUnmatchedCodes.svelte";
import type {
  DashboardSubscriptionsTabProps,
  FormatMessage,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let selectedImportSectionIdSet: Set<number>;
export let selectedImportCount: number;
export let formatMessage: FormatMessage;
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let toggleImportSectionSelection: (sectionId: number) => void;
export let confirmImportSections: () => void | Promise<void>;
export let isImportingSections: boolean;
export let matchedSections: MatchedImportSection[];
export let unmatchedSectionCodes: string[];

export let isConfirmImportOpen: boolean;
</script>

{#if isConfirmImportOpen}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      isConfirmImportOpen = open;
    }}
  >
    <Dialog.Content
      class="max-w-2xl"
    >
      <Dialog.Header>
        <Dialog.Title>
          {formatMessage(subscriptionsCopy.bulkImport.confirmTitle, {
            count: selectedImportCount,
          })}
        </Dialog.Title>
        <Dialog.Description>
          {formatMessage(subscriptionsCopy.bulkImport.matchedSummary, {
            matched: matchedSections.length,
            unmatched: unmatchedSectionCodes.length,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-fit max-h-[60vh]">
        <div class="grid gap-4 px-5 py-4">
          <SubscriptionsBulkImportMatchedList
            {formatMessage}
            {matchedSections}
            {namePrimary}
            {nameSecondary}
            {selectedImportSectionIdSet}
            {subscriptionsCopy}
            {toggleImportSectionSelection}
          />

          <SubscriptionsBulkImportUnmatchedCodes
            {formatMessage}
            {subscriptionsCopy}
            {unmatchedSectionCodes}
          />
        </div>
      </ScrollArea>
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => (isConfirmImportOpen = false)}>
          {subscriptionsCopy.bulkImport.cancel}
        </Button>
        <Button
          disabled={selectedImportCount === 0 || isImportingSections}
          type="button"
          onclick={confirmImportSections}
        >
          {#if isImportingSections}
            <Spinner data-icon="inline-start" />
          {/if}
          {isImportingSections
            ? subscriptionsCopy.bulkImport.importing
            : formatMessage(subscriptionsCopy.bulkImport.subscribeSelected, {
                count: selectedImportCount,
              })}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
