<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type {
  WelcomeBulkImportCopy,
  WelcomeCopy,
  WelcomeDisplayName,
  WelcomeFormatCopy,
  WelcomeImportAction,
  WelcomeMatchedSection,
  WelcomeSectionSelectionSetter,
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
export let unmatchedCodes: string[];
export let welcomeCopy: WelcomeCopy;
</script>

{#if isConfirmImportOpen}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) isConfirmImportOpen = false;
    }}
  >
    <Dialog.Content
      class="max-w-2xl"
      aria-labelledby="welcome-confirm-import-title"
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
          <Field.Set>
            <Field.Legend variant="label" class="sr-only">
              {welcomeCopy.confirmImportTitle}
            </Field.Legend>
            <Field.Group data-slot="checkbox-group" class="gap-2">
              {#each matchedSections as section}
                {@const checkboxId = `welcome-import-section-${section.id}`}
                <Field.Field orientation="horizontal">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedSectionIdSet.has(section.id)}
                    aria-label={formatCopy(welcomeCopy.selectSection, {
                      code: section.code,
                    })}
                    onCheckedChange={(checked) => {
                      setSectionSelection(section.id, checked);
                    }}
                  />
                  <Field.Content>
                    <Field.Label class="cursor-pointer font-normal" for={checkboxId}>
                      {displayName(section.course)}
                    </Field.Label>
                    <Field.Description>
                      {section.code}
                      {#if section.semester} · {displayName(section.semester)}{/if}
                      {#if section.campus} · {displayName(section.campus)}{/if}
                      {#if section.teachers.length > 0}
                        · {section.teachers.map(displayName).filter(Boolean).join(", ")}
                      {/if}
                    </Field.Description>
                  </Field.Content>
                </Field.Field>
              {/each}
            </Field.Group>
          </Field.Set>
        {:else}
          <Empty.Root class="min-h-20 border border-border bg-background p-4">
            <Empty.Header>
              <Empty.Description>{welcomeCopy.noMatchingSections}</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}

        {#if unmatchedCodes.length > 0}
          <Alert.Root>
            <Alert.Title>{formatCopy(bulkCopy.unmatchedCodes, { count: unmatchedCodes.length })}</Alert.Title>
            <Alert.Description>{unmatchedCodes.join(", ")}</Alert.Description>
          </Alert.Root>
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
    </Dialog.Content>
  </Dialog.Root>
{/if}
