<script lang="ts">
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Select } from "$lib/components/ui/select/index.js";
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
    class="max-w-lg"
    aria-labelledby="welcome-bulk-import-title"
    onOpenChange={(open) => {
      if (!open) isBulkImportOpen = false;
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="welcome-bulk-import-title">{bulkCopy.title}</Dialog.Title>
      <Dialog.Description>{bulkCopy.description}</Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 px-5 py-4">
      {#if importError}
        <Alert variant="destructive">
          <span>{importError}</span>
        </Alert>
      {/if}
      {#if importMessage}
        <Alert>
          <span>{importMessage}</span>
        </Alert>
      {/if}
      <label class="grid gap-2">
        <span class="font-medium text-sm">{bulkCopy.semesterLabel}</span>
        <Select
          class="w-full"
          bind:value={selectedSemesterId}
          items={semesterOptions}
          placeholder={bulkCopy.semesterPlaceholder}
        />
      </label>
      <label class="grid gap-2">
        <span class="font-medium text-sm">{welcomeCopy.sectionCodesLabel}</span>
        <Textarea bind:value={importText} placeholder={bulkCopy.placeholder} rows="5" />
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
        {bulkCopy.cancel}
      </Button>
      <Button disabled={!canMatch} type="button" onclick={matchSections}>
        {isMatching ? bulkCopy.matching : bulkCopy.matchButton}
      </Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
