<script lang="ts">
import type { Snippet } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
import { enhance, type SubmitFunction } from "$app/forms";
import type { HomeworkCreateCopy } from "./homework-form-types";

let {
  open,
  onClose,
  copy,
  children,
  submitAction,
  onsubmit,
  saving = false,
  testId,
}: {
  open: boolean;
  onClose: () => void;
  copy: HomeworkCreateCopy;
  children: Snippet;
  submitAction?: SubmitFunction;
  onsubmit?: (event: SubmitEvent) => void;
  saving?: boolean;
  testId?: string;
} = $props();

function enhanceSubmission(form: HTMLFormElement) {
  if (submitAction) return enhance(form, submitAction);
}
</script>

{#if open}
  <Dialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <Dialog.Content
      aria-describedby={undefined}
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-2xl flex-col gap-0 overflow-clip p-0 sm:h-[min(78vh,48rem)] sm:max-h-[min(78vh,48rem)] sm:max-w-2xl"
    >
      <form
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
        method={submitAction ? "POST" : undefined}
        action={submitAction ? "?/createHomework" : undefined}
        use:enhanceSubmission
        {onsubmit}
      >
        <Dialog.Header class="shrink-0 px-5 pb-2 pt-5 pr-14 sm:px-6 sm:pt-6">
          <Dialog.Title class="break-words">{copy.createTitle}</Dialog.Title>
        </Dialog.Header>
        <ScrollArea class="h-0 min-h-0 flex-1">
          <Field.Group class="min-w-0 gap-5 px-5 py-4 sm:px-6 sm:py-5">
            {@render children()}
          </Field.Group>
        </ScrollArea>
        <Dialog.Actions class="mx-0 mb-0 shrink-0 border-t-0 sm:px-6" cancelLabel={copy.cancel} onCancel={onClose} cancelDisabled={saving}>
          <Button
            loading={saving}
            data-testid={testId}
            disabled={saving}
            type="submit"
          >
            {saving ? copy.saving : copy.createAction}
          </Button>
        </Dialog.Actions>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
