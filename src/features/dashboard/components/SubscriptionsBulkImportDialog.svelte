<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Select } from "$lib/components/ui/select/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import type { DashboardSubscriptionsTabProps } from "./subscription-tab-types";

export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let signedData: DashboardSubscriptionsTabProps["signedData"];
export let bulkImportError: string;
export let canMatchImportSections: boolean;
export let isMatchingSections: boolean;
export let resetBulkImport: DashboardSubscriptionsTabProps["resetBulkImport"];
export let matchImportSections: DashboardSubscriptionsTabProps["matchImportSections"];

export let isBulkImportOpen: boolean;
export let bulkImportSemesterId: string;
export let bulkImportText: string;
</script>

{#if isBulkImportOpen}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) resetBulkImport();
      isBulkImportOpen = open;
    }}
  >
    <Dialog.Content
      class="max-w-lg"
    >
      <Dialog.Header>
        <Dialog.Title>{subscriptionsCopy.bulkImport.title}</Dialog.Title>
        <Dialog.Description>
          {subscriptionsCopy.bulkImport.description}
        </Dialog.Description>
      </Dialog.Header>
      <div class="grid gap-4 px-5 py-4">
        {#if bulkImportError}
          <Alert.Root variant="destructive">
            <Alert.Description>{bulkImportError}</Alert.Description>
          </Alert.Root>
        {/if}
        <label class="grid gap-2">
          <span class="font-medium text-sm">{subscriptionsCopy.bulkImport.semesterLabel}</span>
          <Select
            class="w-full"
            bind:value={bulkImportSemesterId}
            items={signedData.subscriptions.semesters.map((semester) => ({
              value: String(semester.id),
              label: semester.nameCn,
            }))}
          />
        </label>
        <label class="grid gap-2">
          <span class="font-medium text-sm">{subscriptionsCopy.bulkImport.sectionCodesLabel}</span>
          <Textarea
            bind:value={bulkImportText}
            placeholder={subscriptionsCopy.bulkImport.placeholder}
            rows="5"
          ></Textarea>
        </label>
      </div>
      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          onclick={() => {
            resetBulkImport();
            isBulkImportOpen = false;
          }}
        >
          {subscriptionsCopy.bulkImport.cancel}
        </Button>
        <Button disabled={!canMatchImportSections} type="button" onclick={matchImportSections}>
          {isMatchingSections
            ? subscriptionsCopy.bulkImport.matching
            : subscriptionsCopy.bulkImport.matchButton}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
