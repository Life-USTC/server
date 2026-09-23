<script lang="ts">
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import * as NativeSelect from "$lib/components/ui/native-select/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { Textarea } from "$lib/components/ui/textarea/index.js";
import type {
  BulkImportAction,
  BulkImportCopy,
  BulkImportSemesterOption,
} from "./bulk-import-types";

export let canMatch: boolean;
export let copy: BulkImportCopy;
export let error = "";
export let importMessage = "";
export let importText: string;
export let isMatching: boolean;
export let isOpen: boolean;
export let match: BulkImportAction;
export let onCancel: () => void;
export let onOpenChange: (open: boolean) => void;
export let semesterId: string;
export let semesterOptions: BulkImportSemesterOption[];

const titleId = "bulk-import-title";
</script>

<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
  <Dialog.Content class="flex max-w-lg flex-col overflow-hidden sm:max-w-lg" aria-labelledby={titleId}>
    <Dialog.Header class="shrink-0">
      <Dialog.Title id={titleId}>{copy.title}</Dialog.Title>
      <Dialog.Description>
        {copy.descriptionPrefix}{" "}<a
          href="https://jw.ustc.edu.cn"
          target="_blank"
          rel="noopener noreferrer"
        >{copy.undergraduateSystem}</a>{" "}{copy.descriptionConjunction}{" "}<a
          href="https://yjs1.ustc.edu.cn"
          target="_blank"
          rel="noopener noreferrer"
        >{copy.graduateSystem}</a>{copy.description}
      </Dialog.Description>
    </Dialog.Header>
    <Field.Group class="min-h-0 gap-4 overflow-y-auto px-5 py-4">
      {#if error}
        <Alert.Root variant="destructive">
          <Alert.Description>{error}</Alert.Description>
        </Alert.Root>
      {/if}
      {#if importMessage}
        <Alert.Root>
          <Alert.Description>{importMessage}</Alert.Description>
        </Alert.Root>
      {/if}
      <Field.Field>
        <Field.Label for="bulk-import-semester">{copy.semesterLabel}</Field.Label>
        <NativeSelect.Root bind:value={semesterId} class="w-full" id="bulk-import-semester">
          {#if !semesterId}
            <NativeSelect.Option disabled value="">
              {copy.semesterPlaceholder}
            </NativeSelect.Option>
          {/if}
          {#each semesterOptions as option}
            <NativeSelect.Option value={option.value}>{option.label}</NativeSelect.Option>
          {/each}
        </NativeSelect.Root>
      </Field.Field>
      <Field.Field>
        <Field.Label for="bulk-import-section-codes">{copy.sectionCodesLabel}</Field.Label>
        <Textarea
          id="bulk-import-section-codes"
          bind:value={importText}
          placeholder={copy.placeholder}
          rows={5}
        />
      </Field.Field>
    </Field.Group>
    <Dialog.Footer class="shrink-0">
      <Button type="button" variant="outline" onclick={onCancel}>{copy.cancel}</Button>
      <Button disabled={!canMatch} type="button" onclick={match}>
        {#if isMatching}
          <Spinner data-icon="inline-start" />
        {/if}
        {isMatching ? copy.matching : copy.matchButton}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
