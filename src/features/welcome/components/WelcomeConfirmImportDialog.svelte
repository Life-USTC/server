<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeDisplayName,
  WelcomeFormatCopy,
  WelcomeImportAction,
  WelcomeMatchedSection,
  WelcomeSectionSelectionSetter,
  WelcomeSectionSelectionToggle,
} from "./welcome-component-types";

export let bulkCopy: WelcomeBulkImportCopy;
export let confirmImport: WelcomeImportAction;
export let displayName: WelcomeDisplayName;
export let formatCopy: WelcomeFormatCopy;
export let isConfirmImportOpen: boolean;
export let isImporting: boolean;
export let matchedSections: WelcomeMatchedSection[];
export let selectedCount: number;
export let selectedSectionIdSet: Set<number>;
export let setSectionSelection: WelcomeSectionSelectionSetter;
export let toggleSectionSelection: WelcomeSectionSelectionToggle;
export let unmatchedCodes: string[];
export let welcomeCopy: WelcomeCopy;
</script>

{#if isConfirmImportOpen}
  <Dialog.Root
    open={true}
    class="max-w-2xl"
    aria-labelledby="welcome-confirm-import-title"
    onOpenChange={(open) => {
      if (!open) isConfirmImportOpen = false;
    }}
  >
    <Dialog.Header>
      <Dialog.Title id="welcome-confirm-import-title">{welcomeCopy.confirmImportTitle}</Dialog.Title>
      <Dialog.Description>
        {formatCopy(welcomeCopy.matchedSummary, {
          matched: matchedSections.length,
          unmatched: unmatchedCodes.length,
        })}
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid max-h-[60vh] gap-4 overflow-y-auto px-5 py-4">
      {#if matchedSections.length > 0}
        <div class="grid gap-2">
          {#each matchedSections as section}
            <div
              class="flex w-full items-start gap-3 rounded-md border border-base-300 bg-base-100 p-3 text-left transition hover:bg-base-200"
            >
              <Checkbox
                checked={selectedSectionIdSet.has(section.id)}
                aria-label={formatCopy(welcomeCopy.selectSection, {
                  code: section.code,
                })}
                onchange={(event) => {
                  setSectionSelection(section.id, event.currentTarget.checked);
                }}
              />
              <button
                class="min-w-0 flex-1 text-left"
                type="button"
                onclick={() => {
                  toggleSectionSelection(section.id);
                }}
              >
                <span class="block font-medium">{displayName(section.course)}</span>
                <span class="block text-base-content/60 text-sm">
                  {section.code}
                  {#if section.semester} · {displayName(section.semester)}{/if}
                  {#if section.campus} · {displayName(section.campus)}{/if}
                  {#if section.teachers.length > 0}
                    · {section.teachers.map(displayName).filter(Boolean).join(", ")}
                  {/if}
                </span>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-base-content/60 text-sm">{welcomeCopy.noMatchingSections}</p>
      {/if}

      {#if unmatchedCodes.length > 0}
        <div class="rounded-md border border-base-300 bg-base-200/50 p-3">
          <p class="font-medium text-sm">{formatCopy(bulkCopy.unmatchedCodes, { count: unmatchedCodes.length })}</p>
          <p class="mt-1 text-base-content/60 text-sm">{unmatchedCodes.join(", ")}</p>
        </div>
      {/if}
    </div>
    <Dialog.Footer>
      <Button type="button" variant="outline" onclick={() => (isConfirmImportOpen = false)}>{bulkCopy.cancel}</Button>
      <Button disabled={selectedCount === 0 || isImporting} type="button" onclick={confirmImport}>
        {isImporting
          ? welcomeCopy.importing
          : formatCopy(welcomeCopy.subscribeSelected, { count: selectedCount })}
      </Button>
    </Dialog.Footer>
  </Dialog.Root>
{/if}
