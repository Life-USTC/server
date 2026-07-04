<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as Select from "$lib/components/ui/select/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeImportAction,
  WelcomeSelectOption,
} from "./welcome-component-types";

export let bulkCopy: WelcomeBulkImportCopy;
export let canMatch: boolean;
export let importError: string;
export let importMessage: string;
export let importText: string;
export let isBulkImportOpen: boolean;
export let isMatching: boolean;
export let matchSections: WelcomeImportAction;
export let resetBulkImport: () => void;
export let selectedSemesterId: string;
export let semesterOptions: WelcomeSelectOption[];
export let welcomeCopy: WelcomeCopy;
</script>

{#if isBulkImportOpen}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) isBulkImportOpen = false;
    }}
  >
    <Dialog.Content
      class="max-w-lg"
      aria-labelledby="welcome-bulk-import-title"
    >
      <Dialog.Header>
        <Dialog.Title id="welcome-bulk-import-title">{bulkCopy.title}</Dialog.Title>
        <Dialog.Description>{bulkCopy.description}</Dialog.Description>
      </Dialog.Header>
      <div class="grid gap-4 px-5 py-4">
        {#if importError}
          <Alert.Root variant="destructive">
            <Alert.Description>{importError}</Alert.Description>
          </Alert.Root>
        {/if}
        {#if importMessage}
          <Alert.Root>
            <Alert.Description>{importMessage}</Alert.Description>
          </Alert.Root>
        {/if}
        <Field.Field>
          <Field.Label for="welcome-bulk-import-semester">
            {bulkCopy.semesterLabel}
          </Field.Label>
          <Select.Root bind:value={selectedSemesterId} type="single">
            <Select.Trigger id="welcome-bulk-import-semester" class="w-full">
              {semesterOptions.find((option) => option.value === selectedSemesterId)
                ?.label ?? bulkCopy.semesterPlaceholder}
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
          <Field.Label for="welcome-bulk-import-section-codes">
            {welcomeCopy.sectionCodesLabel}
          </Field.Label>
          <Textarea
            id="welcome-bulk-import-section-codes"
            bind:value={importText}
            placeholder={bulkCopy.placeholder}
            rows={5}
          />
        </Field.Field>
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
          {bulkCopy.cancel}
        </Button>
        <Button disabled={!canMatch} type="button" onclick={matchSections}>
          {isMatching ? bulkCopy.matching : bulkCopy.matchButton}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
