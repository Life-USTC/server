<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import type {
  BulkImportCopy,
  BulkImportFormatMessage,
  BulkImportSectionView,
  BulkImportSelectionSetter,
} from "./bulk-import-types";

export let copy: BulkImportCopy;
export let formatMessage: BulkImportFormatMessage;
export let importError = "";
export let isImporting: boolean;
export let isOpen: boolean;
export let matchedSections: BulkImportSectionView[];
export let onCancel: () => void;
export let onConfirm: () => void | Promise<void>;
export let onOpenChange: (open: boolean) => void;
export let selectedSectionIdSet: Set<number>;
export let setSectionSelection: BulkImportSelectionSetter;
export let unmatchedCodes: string[];

const titleId = "bulk-import-confirm-title";
</script>

<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
  <Dialog.Content class="max-w-2xl sm:max-w-2xl" aria-labelledby={titleId}>
    <Dialog.Header>
      <Dialog.Title id={titleId}>
        {formatMessage(copy.confirmTitle, { count: selectedSectionIdSet.size })}
      </Dialog.Title>
      <Dialog.Description>
        {formatMessage(copy.matchedSummary, {
          matched: matchedSections.length,
          unmatched: unmatchedCodes.length,
        })}
      </Dialog.Description>
    </Dialog.Header>
    <ScrollArea class="h-[min(60vh,24rem)]">
      <div class="grid gap-4 px-5 py-4">
        {#if importError}
          <Alert.Root variant="destructive">
            <Alert.Description>{importError}</Alert.Description>
          </Alert.Root>
        {/if}
        {#if matchedSections.length > 0}
          <Field.Set>
            <Field.Legend variant="label" class="sr-only">{copy.confirmTitle}</Field.Legend>
            <Field.Group data-slot="checkbox-group" class="gap-2">
              {#each matchedSections as section}
                {@const checkboxId = `bulk-import-section-${section.id}`}
                <Field.Field orientation="horizontal">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedSectionIdSet.has(section.id)}
                    aria-label={formatMessage(copy.selectSection, { code: section.code })}
                    onCheckedChange={(checked) => {
                      setSectionSelection(section.id, checked === true);
                    }}
                  />
                  <Field.Content>
                    <Field.Label class="cursor-pointer" for={checkboxId}>
                      {section.courseName}
                      {#if section.courseSecondaryName}
                        <span class="text-muted-foreground">({section.courseSecondaryName})</span>
                      {/if}
                    </Field.Label>
                    <Field.Description>
                      {section.code}
                      {#if section.semesterName} · {section.semesterName}{/if}
                      {#if section.campusName} · {section.campusName}{/if}
                      {#if section.teacherNames} · {section.teacherNames}{/if}
                    </Field.Description>
                  </Field.Content>
                </Field.Field>
              {/each}
            </Field.Group>
          </Field.Set>
        {:else}
          <Empty.Root class="min-h-20 p-4">
            <Empty.Header>
              <Empty.Description>{copy.noMatches}</Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}

        {#if unmatchedCodes.length > 0}
          <Alert.Root>
            <Alert.Title>
              {formatMessage(copy.unmatchedCodes, { count: unmatchedCodes.length })}
            </Alert.Title>
            <Alert.Description>{unmatchedCodes.join(", ")}</Alert.Description>
          </Alert.Root>
        {/if}
      </div>
    </ScrollArea>
    <Dialog.Footer>
      <Button type="button" variant="outline" onclick={onCancel}>{copy.cancel}</Button>
      <Button disabled={selectedSectionIdSet.size === 0 || isImporting} type="button" onclick={onConfirm}>
        {#if isImporting}
          <Spinner data-icon="inline-start" />
        {/if}
        {isImporting
          ? copy.importing
          : formatMessage(copy.subscribeSelected, { count: selectedSectionIdSet.size })}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
