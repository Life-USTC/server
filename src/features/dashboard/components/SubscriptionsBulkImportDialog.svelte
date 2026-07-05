<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
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

$: semesterOptions = signedData.subscriptions.semesters.map((semester) => ({
  value: String(semester.id),
  label: semester.nameCn,
}));
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
      <Field.Group class="gap-4 px-5 py-4">
        {#if bulkImportError}
          <Alert.Root variant="destructive">
            <Alert.Description>{bulkImportError}</Alert.Description>
          </Alert.Root>
        {/if}
        <Field.Field>
          <Field.Label for="subscriptions-bulk-import-semester">
            {subscriptionsCopy.bulkImport.semesterLabel}
          </Field.Label>
          <Select.Root bind:value={bulkImportSemesterId} type="single">
            <Select.Trigger id="subscriptions-bulk-import-semester" class="w-full">
              {semesterOptions.find((option) => option.value === bulkImportSemesterId)
                ?.label ?? semesterOptions[0]?.label ?? ""}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each semesterOptions as option}
                  <Select.Item label={option.label} value={option.value}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </Field.Field>
        <Field.Field>
          <Field.Label for="subscriptions-bulk-import-section-codes">
            {subscriptionsCopy.bulkImport.sectionCodesLabel}
          </Field.Label>
          <Textarea
            id="subscriptions-bulk-import-section-codes"
            bind:value={bulkImportText}
            placeholder={subscriptionsCopy.bulkImport.placeholder}
            rows={5}
          ></Textarea>
        </Field.Field>
      </Field.Group>
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
          {#if isMatchingSections}
            <Spinner data-icon="inline-start" />
          {/if}
          {isMatchingSections
            ? subscriptionsCopy.bulkImport.matching
            : subscriptionsCopy.bulkImport.matchButton}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
